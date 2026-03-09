import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

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

async function getChallengeById(id: string): Promise<Challenge | null> {
  try {
    const raw = await redis.get<string>(`challenge:${id}`);
    if (!raw) return null;
    const challenge: Challenge = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Süre dolmuş mu kontrol et
    if (challenge.status === "pending" && Date.now() > challenge.expiresAt) {
      challenge.status = "expired";
      await redis.set(`challenge:${id}`, JSON.stringify(challenge));
    }

    return challenge;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);
    const fid = user.fid;

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter"); // incoming, sent, completed, all

    // Gönderilen ve alınan challenge ID'lerini al
    const [sentIds, receivedIds] = await Promise.all([
      redis.smembers(`user:${fid}:challenges:sent`),
      redis.smembers(`user:${fid}:challenges:received`),
    ]);

    const allIds = new Set([...sentIds, ...receivedIds]);
    const challenges: Challenge[] = [];

    // Challenge'ları getir
    for (const id of allIds) {
      const challenge = await getChallengeById(id as string);
      if (challenge) {
        challenges.push(challenge);
      }
    }

    // Sırala - en yeni önce
    challenges.sort((a, b) => b.createdAt - a.createdAt);

    // Filtrele
    let filtered = challenges;
    if (filter === "incoming") {
      // Bana gelen bekleyen challenge'lar
      filtered = challenges.filter((c) => {
        // Direct challenge ise ben hedefim ve pending
        if (c.type === "direct" && c.targetFid === fid && c.status === "pending") {
          return true;
        }
        // Open challenge ise ben creator değilim ve pending
        if (c.type === "open" && c.creatorFid !== fid && c.status === "pending") {
          return true;
        }
        return false;
      });
    } else if (filter === "sent") {
      // Benim gönderdiğim bekleyen challenge'lar
      filtered = challenges.filter(
        (c) => c.creatorFid === fid && c.status === "pending"
      );
    } else if (filter === "completed") {
      // Tamamlanan challenge'lar
      filtered = challenges.filter((c) => c.status === "completed");
    }
    // filter === "all" veya undefined ise tüm challenge'lar

    return NextResponse.json({ challenges: filtered });
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Challenge list error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
