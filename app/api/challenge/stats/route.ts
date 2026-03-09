import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);
    const fid = user.fid;

    const stats = await redis.hgetall(`user:${fid}:challenge:stats`);

    const wins = typeof stats?.wins === "number" ? stats.wins : parseInt(String(stats?.wins || "0"), 10);
    const losses = typeof stats?.losses === "number" ? stats.losses : parseInt(String(stats?.losses || "0"), 10);

    return NextResponse.json({
      wins,
      losses,
      total: wins + losses,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    });
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Challenge stats error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
