import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  requireQuickAuthUser,
  isInvalidTokenError,
} from "@/lib/quick-auth-server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const NOTIFICATION_TOKENS_KEY = "notification:tokens";

interface NotificationRequest {
  title: string;
  body: string;
}

interface StoredToken {
  url: string;
  token: string;
  updatedAt: number;
}

export async function POST(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    if (!isAdmin(user.fid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, body }: NotificationRequest = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    if (title.length > 32) {
      return NextResponse.json(
        { error: "Title max 32 characters" },
        { status: 400 }
      );
    }

    if (body.length > 200) {
      return NextResponse.json(
        { error: "Body max 200 characters" },
        { status: 400 }
      );
    }

    // Tüm token'ları al
    const allTokens = await redis.hgetall<Record<string, string>>(NOTIFICATION_TOKENS_KEY);

    if (!allTokens || Object.keys(allTokens).length === 0) {
      return NextResponse.json(
        { error: "No users to notify", sent: 0 },
        { status: 200 }
      );
    }

    // Token'ları URL'e göre grupla
    const tokensByUrl: Record<string, string[]> = {};

    for (const [fid, data] of Object.entries(allTokens)) {
      try {
        const parsed: StoredToken = typeof data === "string" ? JSON.parse(data) : data;
        const url = parsed.url;
        const token = parsed.token;

        if (!tokensByUrl[url]) {
          tokensByUrl[url] = [];
        }
        tokensByUrl[url].push(token);
      } catch (e) {
        console.error(`Failed to parse token for fid ${fid}:`, e);
      }
    }

    const notificationId = `admin-${Date.now()}`;
    const targetUrl = process.env.NEXT_PUBLIC_APP_URL || "https://farbase-drop.vercel.app";

    let totalSent = 0;
    let totalFailed = 0;

    // Her URL grubuna bildirim gönder
    for (const [url, tokens] of Object.entries(tokensByUrl)) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notificationId,
            title,
            body,
            targetUrl,
            tokens,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          totalSent += result.successfulTokens?.length || tokens.length;
          totalFailed += result.invalidTokens?.length || 0;

          // Invalid token'ları temizle
          if (result.invalidTokens && result.invalidTokens.length > 0) {
            // Token'dan fid'i bul ve sil
            for (const [fid, data] of Object.entries(allTokens)) {
              try {
                const parsed: StoredToken = typeof data === "string" ? JSON.parse(data) : data;
                if (result.invalidTokens.includes(parsed.token)) {
                  await redis.hdel(NOTIFICATION_TOKENS_KEY, fid);
                  console.log(`Removed invalid token for fid ${fid}`);
                }
              } catch {}
            }
          }
        } else {
          console.error(`Failed to send to ${url}:`, await response.text());
          totalFailed += tokens.length;
        }
      } catch (e) {
        console.error(`Error sending to ${url}:`, e);
        totalFailed += tokens.length;
      }
    }

    return NextResponse.json(
      {
        success: true,
        sent: totalSent,
        failed: totalFailed,
        notificationId,
      },
      { status: 200 }
    );
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}

// Kayıtlı kullanıcı sayısını görmek için GET
export async function GET(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    if (!isAdmin(user.fid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allTokens = await redis.hgetall(NOTIFICATION_TOKENS_KEY);
    const count = allTokens ? Object.keys(allTokens).length : 0;

    return NextResponse.json({ subscribedUsers: count }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to get count" }, { status: 500 });
  }
}
