import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";
import { getRemainingAttempts, getResetInSeconds } from "@/lib/attempts";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function checkAdmin(fid: number): boolean {
  const adminFid = Number(process.env.ADMIN_FID || "0");
  return adminFid > 0 && fid === adminFid;
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

    if (!mode || (mode !== "practice" && mode !== "tournament")) {
      return NextResponse.json({ error: "Invalid mode parameter" }, { status: 400 });
    }

    const admin = checkAdmin(fid);

    if (admin) {
      return NextResponse.json({
        mode,
        remaining: 999,
        limit: 3,
        isAdmin: true,
        resetAt: mode === "practice" ? nextUtcMidnightMs(Date.now()) : null,
        resetInSeconds: mode === "practice"
          ? Math.max(0, Math.floor((nextUtcMidnightMs(Date.now()) - Date.now()) / 1000))
          : null,
      });
    }

    const remaining = await getRemainingAttempts(redis, mode, fid, false);
    const resetInSeconds = await getResetInSeconds(redis, mode, fid);

    return NextResponse.json({
      mode,
      remaining,
      limit: 3,
      isAdmin: false,
      resetAt: null,
      resetInSeconds,
    });
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("remaining-attempts error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
