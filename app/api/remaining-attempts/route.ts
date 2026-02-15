import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";
import {
  getPracticeRemaining,
  getTournamentRemaining,
  getPracticeResetInSeconds,
  PRACTICE_LIMIT,
  PRACTICE_LIMIT_ADMIN,
  TOURNAMENT_ATTEMPTS_PER_ENTRY,
} from "@/lib/attempts";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function checkAdmin(fid: number): boolean {
  const adminFid = Number(process.env.ADMIN_FID || "0");
  return adminFid > 0 && fid === adminFid;
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

    if (mode === "practice") {
      const remaining = await getPracticeRemaining(redis, fid, admin);
      const resetInSeconds = getPracticeResetInSeconds();
      const limit = admin ? PRACTICE_LIMIT_ADMIN : PRACTICE_LIMIT;

      return NextResponse.json({
        mode,
        remaining,
        limit,
        isAdmin: admin,
        resetAt: Date.now() + resetInSeconds * 1000,
        resetInSeconds,
      });
    }

    // Tournament
    const remaining = await getTournamentRemaining(redis, fid);

    return NextResponse.json({
      mode,
      remaining,
      limit: TOURNAMENT_ATTEMPTS_PER_ENTRY,
      isAdmin: admin,
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
