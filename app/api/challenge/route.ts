import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const CHALLENGE_EXPIRY_HOURS = 24;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || "";

type Challenge = {
  id: string;
  creatorFid: number;
  creatorUsername: string;
  creatorScore: number | null;
  targetFid: number | null;
  targetUsername: string | null;
  targetScore: number | null;
  type: "open" | "direct";
  status: "pending" | "accepted" | "completed" | "expired";
  winner: "creator" | "target" | "tie" | null;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
};

function genChallengeId(): string {
  try {
    const c: any = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch {}
  return `ch_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

async function getUserByUsername(username: string): Promise<{ fid: number; username: string } | null> {
  if (!NEYNAR_API_KEY) return null;

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`,
      {
        headers: { api_key: NEYNAR_API_KEY },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const user = data?.user;
    if (user?.fid && user?.username) {
      return { fid: user.fid, username: user.username };
    }
    return null;
  } catch {
    return null;
  }
}

async function getUserByFid(fid: number): Promise<{ fid: number; username: string; displayName?: string } | null> {
  if (!NEYNAR_API_KEY) return null;

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: { api_key: NEYNAR_API_KEY },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const user = data?.users?.[0];
    if (user?.fid && user?.username) {
      return { fid: user.fid, username: user.username, displayName: user.display_name };
    }
    return null;
  } catch {
    return null;
  }
}

async function sendNotification(
  targetFid: number,
  title: string,
  body: string,
  targetUrl?: string
) {
  try {
    const notifKey = `notif:${targetFid}`;
    const notifData = await redis.get<{ url: string; token: string }>(notifKey);
    if (!notifData?.url || !notifData?.token) return;

    const miniappUrl =
      process.env.NEXT_PUBLIC_MINIAPP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://farbase-drop.vercel.app";

    await fetch(notifData.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationId: `challenge-${Date.now()}`,
        title,
        body,
        targetUrl: targetUrl || miniappUrl,
        tokens: [notifData.token],
      }),
    });
  } catch (e) {
    console.error("Notification error:", e);
  }
}

// POST: Challenge oluştur
export async function POST(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);
    const creatorFid = user.fid;

    const body = await req.json();
    const { type, targetUsername, score } = body;

    if (type !== "open" && type !== "direct") {
      return NextResponse.json({ error: "Invalid challenge type" }, { status: 400 });
    }

    // Creator bilgilerini al
    const creatorInfo = await getUserByFid(creatorFid);
    if (!creatorInfo) {
      return NextResponse.json({ error: "Creator not found" }, { status: 400 });
    }

    let targetFid: number | null = null;
    let resolvedTargetUsername: string | null = null;

    // Direct challenge ise hedef kullanıcıyı bul
    if (type === "direct") {
      if (!targetUsername) {
        return NextResponse.json({ error: "Target username required for direct challenge" }, { status: 400 });
      }

      // @ işaretini kaldır
      const cleanUsername = targetUsername.replace(/^@/, "");

      // Kendine challenge kontrolü
      if (cleanUsername.toLowerCase() === creatorInfo.username.toLowerCase()) {
        return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 });
      }

      const targetUser = await getUserByUsername(cleanUsername);
      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      targetFid = targetUser.fid;
      resolvedTargetUsername = targetUser.username;
    }

    const challengeId = genChallengeId();
    const now = Date.now();
    const expiresAt = now + CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000;

    const challenge: Challenge = {
      id: challengeId,
      creatorFid,
      creatorUsername: creatorInfo.username,
      creatorScore: typeof score === "number" ? score : null,
      targetFid,
      targetUsername: resolvedTargetUsername,
      targetScore: null,
      type,
      status: "pending",
      winner: null,
      createdAt: now,
      expiresAt,
      completedAt: null,
    };

    // Redis'e kaydet
    await redis.set(`challenge:${challengeId}`, JSON.stringify(challenge));
    await redis.expire(`challenge:${challengeId}`, CHALLENGE_EXPIRY_HOURS * 60 * 60 + 3600); // +1 saat buffer

    // Gönderilen listesine ekle
    await redis.sadd(`user:${creatorFid}:challenges:sent`, challengeId);

    // Direct challenge ise hedefin gelen listesine ekle ve bildirim gönder
    if (type === "direct" && targetFid) {
      await redis.sadd(`user:${targetFid}:challenges:received`, challengeId);

      // Bildirim gönder
      const miniappUrl =
        process.env.NEXT_PUBLIC_MINIAPP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://farbase-drop.vercel.app";

      const scoreText = challenge.creatorScore ? ` Beat ${challenge.creatorScore} pts!` : "";
      await sendNotification(
        targetFid,
        "⚔️ Challenge Received!",
        `@${creatorInfo.username} challenges you!${scoreText}`,
        `${miniappUrl}?challenge=${challengeId}`
      );
    }

    return NextResponse.json({ success: true, challenge });
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Challenge create error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: Challenge getir
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const challengeId = searchParams.get("id");

    if (!challengeId) {
      return NextResponse.json({ error: "Challenge ID required" }, { status: 400 });
    }

    const raw = await redis.get<string>(`challenge:${challengeId}`);
    if (!raw) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const challenge: Challenge = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Süre dolmuş mu kontrol et
    if (challenge.status === "pending" && Date.now() > challenge.expiresAt) {
      challenge.status = "expired";
      await redis.set(`challenge:${challengeId}`, JSON.stringify(challenge));
    }

    return NextResponse.json({ challenge });
  } catch (e) {
    console.error("Challenge get error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Challenge'ı tamamla (rakip oynadıktan sonra)
export async function PUT(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);
    const playerFid = user.fid;

    const body = await req.json();
    const { challengeId, score } = body;

    if (!challengeId || typeof score !== "number") {
      return NextResponse.json({ error: "Challenge ID and score required" }, { status: 400 });
    }

    const raw = await redis.get<string>(`challenge:${challengeId}`);
    if (!raw) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const challenge: Challenge = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Süre dolmuş mu kontrol et
    if (Date.now() > challenge.expiresAt) {
      challenge.status = "expired";
      await redis.set(`challenge:${challengeId}`, JSON.stringify(challenge));
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    // Zaten tamamlanmış mı
    if (challenge.status === "completed") {
      return NextResponse.json({ error: "Challenge already completed" }, { status: 400 });
    }

    // Kendi challenge'ına cevap veremez
    if (challenge.creatorFid === playerFid) {
      return NextResponse.json({ error: "Cannot complete your own challenge" }, { status: 400 });
    }

    // Direct challenge ise sadece hedef tamamlayabilir
    if (challenge.type === "direct" && challenge.targetFid !== playerFid) {
      return NextResponse.json({ error: "This challenge is not for you" }, { status: 403 });
    }

    // Oyuncunun bilgilerini al
    const playerInfo = await getUserByFid(playerFid);
    if (!playerInfo) {
      return NextResponse.json({ error: "Player not found" }, { status: 400 });
    }

    // Challenge'ı güncelle
    challenge.targetFid = playerFid;
    challenge.targetUsername = playerInfo.username;
    challenge.targetScore = score;
    challenge.status = "completed";
    challenge.completedAt = Date.now();

    // Kazananı belirle
    if (challenge.creatorScore === null) {
      // Creator skoru yoksa, şimdi creator'ın oynaması gerekiyor
      // Ama bizim akışımızda creator önce oynuyor, bu durum olmamalı
      // Yine de güvenlik için: target kazanır
      challenge.winner = "target";
    } else if (score > challenge.creatorScore) {
      challenge.winner = "target";
    } else if (score < challenge.creatorScore) {
      challenge.winner = "creator";
    } else {
      challenge.winner = "tie";
    }

    // Redis'e kaydet
    await redis.set(`challenge:${challengeId}`, JSON.stringify(challenge));

    // Open challenge ise, target'ın received listesine ekle
    if (challenge.type === "open") {
      await redis.sadd(`user:${playerFid}:challenges:received`, challengeId);
    }

    // İstatistikleri güncelle
    if (challenge.winner === "creator") {
      await redis.hincrby(`user:${challenge.creatorFid}:challenge:stats`, "wins", 1);
      await redis.hincrby(`user:${playerFid}:challenge:stats`, "losses", 1);
    } else if (challenge.winner === "target") {
      await redis.hincrby(`user:${playerFid}:challenge:stats`, "wins", 1);
      await redis.hincrby(`user:${challenge.creatorFid}:challenge:stats`, "losses", 1);
    }
    // Tie durumunda istatistik güncellenmez

    // Creator'a bildirim gönder
    const miniappUrl =
      process.env.NEXT_PUBLIC_MINIAPP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://farbase-drop.vercel.app";

    let notifTitle = "⚔️ Challenge Complete!";
    let notifBody = "";
    if (challenge.winner === "creator") {
      notifBody = `You beat @${playerInfo.username}! ${challenge.creatorScore} vs ${score}`;
    } else if (challenge.winner === "target") {
      notifBody = `@${playerInfo.username} beat you! ${score} vs ${challenge.creatorScore}`;
    } else {
      notifBody = `It's a tie with @${playerInfo.username}! ${score} vs ${challenge.creatorScore}`;
    }

    await sendNotification(challenge.creatorFid, notifTitle, notifBody, miniappUrl);

    return NextResponse.json({ success: true, challenge });
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Challenge complete error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
