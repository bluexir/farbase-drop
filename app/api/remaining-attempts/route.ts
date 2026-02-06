import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";
import { getRemainingAttemptsTournament } from "@/lib/attempts";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function isAdmin(fid: number): boolean {
  const adminFid = Number(process.env.ADMIN_FID || "0");
  return adminFid > 0 && fid === adminFid;
}

function utcDateKey(ts: number): string {
  // YYYY-MM-DD (UTC)
  return new Date(ts).toISOString().slice(0, 10);
}

function nextUtcMidnightMs(nowMs: number): number {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return Date.UTC(y, m, day + 1, 0, 0, 0, 0);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);
    const fid = user.fid;

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    if (!mode) {
      return NextResponse.json({ error: "Missing required parameter: mode" }, { status: 400 });
    }
    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // Admin: sınırsız
    if (isAdmin(fid)) {
      return NextResponse.json({
        mode,
        remaining: 999,
        limit: 3,
        isAdmin: true,
        resetAt: mode === "practice" ? nextUtcMidnightMs(Date.now()) : null,
        resetInSeconds: mode === "practice" ? Math.max(0, Math.floor((nextUtcMidnightMs(Date.now()) - Date.now()) / 1000)) : null,
      });
    }

    if (mode === "practice") {
      const now = Date.now();
      const today = utcDateKey(now);
      const dailyKey = `practice:daily:${fid}:${today}`;

      const usedRaw = await redis.get<number>(dailyKey);
      const used = typeof usedRaw === "number" ? usedRaw : Number(usedRaw || 0);

      const remaining = Math.max(0, 3 - used);

      const resetAt = nextUtcMidnightMs(now);
      const resetInSeconds = Math.max(0, Math.floor((resetAt - now) / 1000));

      return NextResponse.json({
        mode,
        remaining,
        limit: 3,
        isAdmin: false,
        resetAt,
        resetInSeconds,
      });
    }

    // tournament
    const remaining = await getRemainingAttemptsTournament(fid);

    return NextResponse.json({
      mode,
      remaining,
      limit: 3,
      isAdmin: false,
      resetAt: null,
      resetInSeconds: null,
    });
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("remaining-attempts error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
