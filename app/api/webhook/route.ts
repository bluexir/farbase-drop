import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const NOTIFICATION_TOKENS_KEY = "notification:tokens";

interface WebhookPayload {
  event: "miniapp_added" | "miniapp_removed" | "notifications_enabled" | "notifications_disabled";
  fid: number;
  notificationDetails?: {
    url: string;
    token: string;
  };
}

export async function POST(request: Request) {
  try {
    const payload: WebhookPayload = await request.json();
    const { event, fid, notificationDetails } = payload;

    console.log(`Webhook received: ${event} for fid ${fid}`);

    if (event === "miniapp_added" || event === "notifications_enabled") {
      if (notificationDetails?.token && notificationDetails?.url) {
        // Token'ı kaydet: fid -> { url, token }
        await redis.hset(NOTIFICATION_TOKENS_KEY, {
          [fid.toString()]: JSON.stringify({
            url: notificationDetails.url,
            token: notificationDetails.token,
            updatedAt: Date.now(),
          }),
        });
        console.log(`Notification token saved for fid ${fid}`);
      }
    }

    if (event === "miniapp_removed" || event === "notifications_disabled") {
      // Token'ı sil
      await redis.hdel(NOTIFICATION_TOKENS_KEY, fid.toString());
      console.log(`Notification token removed for fid ${fid}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
