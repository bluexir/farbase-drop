import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";
import { getRemainingAttemptsTournament, useTournamentAttempt } from "@/lib/attempts";

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

export async function POST(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);
    const fid = user.fid;

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode as "practice" | "tournament" | undefined;

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // Admin: sınırsız (attempt düşürmeyiz)
    if (isAdmin(fid)) {
      return NextResponse.json(
        {
          ok: true,
          mode,
          remaining: 999,
          limit: 3,
          isAdmin: true,
          resetAt: mode === "practice" ? nextUtcMidnightMs(Date.now()) : null,
          resetInSeconds:
            mode === "practice"
              ? Math.max(0, Math.floor((nextUtcMidnightMs(Date.now()) - Date.now()) / 1000))
              : null,
        },
        { status: 200 }
      );
    }

    if (mode === "practice") {
      const now = Date.now();
      const today = utcDateKey(now);
      const dailyKey = `practice:daily:${fid}:${today}`;

      // Kullanım sayısını atomik arttır
      const used = await redis.incr(dailyKey);
      const resetAt = nextUtcMidnightMs(now);
      const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
      await redis.expire(dailyKey, ttlSeconds);

      // Limit 3
      if (Number(used) > 3) {
        // Limit aşıldıysa geri al (best-effort)
        try {
          await redis.decr(dailyKey);
        } catch {
          // ignore
        }

        return NextResponse.json(
          {
            ok: false,
            mode,
            remaining: 0,
            limit: 3,
            isAdmin: false,
            resetAt,
            resetInSeconds: Math.max(0, Math.floor((resetAt - now) / 1000)),
          },
          { status: 200 }
        );
      }

      const remaining = Math.max(0, 3 - Number(used));
      return NextResponse.json(
        {
          ok: true,
          mode,
          remaining,
          limit: 3,
          isAdmin: false,
          resetAt,
          resetInSeconds: Math.max(0, Math.floor((resetAt - now) / 1000)),
        },
        { status: 200 }
      );
    }

    // tournament
    const ok = await useTournamentAttempt(fid);
    const remaining = await getRemainingAttemptsTournament(fid);

    return NextResponse.json(
      {
        ok,
        mode,
        remaining,
        limit: 3,
        isAdmin: false,
        resetAt: null,
        resetInSeconds: null,
      },
      { status: 200 }
    );
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("use-attempt error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
