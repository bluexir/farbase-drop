import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  requireQuickAuthUser,
  isInvalidTokenError,
} from "@/lib/quick-auth-server";
import { isAdmin } from "@/lib/admin";
import {
  consumeAttempt,
  getRemainingAttempts,
  getWeekKey,
} from "@/lib/attempts";
import { saveScore, getPlayerBestScore } from "@/lib/leaderboard";
import { validateGameLog } from "@/lib/game-log";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function clampInt(n: any, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

export async function POST(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    const body = await request.json();

    const mode = body?.mode;
    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'practice' or 'tournament'" },
        { status: 400 }
      );
    }

    const admin = isAdmin(user.fid);

    const address =
      typeof body?.address === "string" ? body.address : "0x0";
    const score = clampInt(body?.score, 0, 10_000_000);
    const mergeCount = clampInt(body?.mergeCount, 0, 100_000);
    const highestLevel = clampInt(body?.highestLevel, 1, 999);

    const gameLog = body?.gameLog;
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId : "";

    // Basic validation
    if (!sessionId || !gameLog) {
      return NextResponse.json(
        { error: "Missing sessionId or gameLog" },
        { status: 400 }
      );
    }

    // Anti-cheat validation
    const validation = validateGameLog(gameLog, {
      fid: user.fid,
      sessionId,
      mode,
      score,
      mergeCount,
      highestLevel,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { error: "Invalid game log", details: validation.reason },
        { status: 400 }
      );
    }

    // Consume attempt (unless admin)
    const consumed = await consumeAttempt(redis, mode, user.fid, admin);

    if (!consumed.ok) {
      const remaining = await getRemainingAttempts(redis, mode, user.fid, admin);
      return NextResponse.json(
        {
          success: false,
          error: consumed.error,
          remaining,
        },
        { status: 403 }
      );
    }

    // Determine if new best
    const prevBest = await getPlayerBestScore(mode, user.fid);
    const isNewBest = !prevBest || score > prevBest.score;

    // Save score (leaderboard module handles "keep higher")
    await saveScore(mode, {
      fid: user.fid,
      address,
      score,
      mergeCount,
      highestLevel,
      playedAt: Date.now(),
    });

    // For tournament mode, accumulate pool (in USDC) only when score is saved
    // This is a lightweight approximation: pool is based on entries (create-entry) in real flow.
    // Here we just ensure we don't double-add if score is invalid.
    if (mode === "tournament" && !admin) {
      // Pool value should be managed by on-chain contract ideally.
      // We'll keep server-side view for UI.
      const weekKey = getWeekKey();
      const poolKey = `tournament:pool:${weekKey}:usdc`;

      const current = (await redis.get<string>(poolKey)) ?? "0";
      // In this game design, each entry is 1 USDC and gives 3 attempts.
      // Score save consumes attempts; entry creation should add pool.
      // So we DO NOT add to pool here.
      await redis.set(poolKey, current);
    }

    const remaining = await getRemainingAttempts(redis, mode, user.fid, admin);

    return NextResponse.json(
      {
        success: true,
        remaining,
        isNewBest,
      },
      { status: 200 }
    );
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Save score error:", error);
    return NextResponse.json(
      { error: "Failed to save score", details: String(error) },
      { status: 500 }
    );
  }
}
