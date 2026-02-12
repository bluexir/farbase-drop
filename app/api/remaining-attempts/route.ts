import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  requireQuickAuthUser,
  isInvalidTokenError,
} from "@/lib/quick-auth-server";
import { isAdmin } from "@/lib/admin";
import {
  getRemainingAttempts,
  getResetInSeconds,
  ATTEMPT_LIMITS,
} from "@/lib/attempts";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'practice' or 'tournament'" },
        { status: 400 }
      );
    }

    const admin = isAdmin(user.fid);
    const remaining = await getRemainingAttempts(redis, mode, user.fid, admin);
    const resetInSeconds = await getResetInSeconds(redis, mode, user.fid);

    return NextResponse.json(
      {
        mode,
        remaining,
        limit: ATTEMPT_LIMITS[mode],
        isAdmin: admin,
        resetInSeconds,
      },
      { status: 200 }
    );
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Remaining attempts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch remaining attempts" },
      { status: 500 }
    );
  }
}
