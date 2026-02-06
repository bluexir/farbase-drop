import { NextResponse } from "next/server";
import { saveScore, LeaderboardEntry } from "@/lib/leaderboard";
import { calculateScoreFromLog, validateGameLog, GameLog } from "@/lib/game-log";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);

    const body = await request.json();
    const {
      address,
      score,
      mergeCount,
      highestLevel,
      mode,
      gameLog,
      sessionId
    } = body;

    if (!address || !mode || !sessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const logValidation = validateGameLog(gameLog as GameLog);
    if (!logValidation.valid) {
      console.error("Invalid game log:", logValidation.errors);
      return NextResponse.json(
        { error: "Invalid game data", details: logValidation.errors },
        { status: 400 }
      );
    }

    const calculated = calculateScoreFromLog(gameLog as GameLog);

    const scoreDiff = Math.abs(calculated.score - score);
    const scoreTolerance = score * 0.05;

    if (scoreDiff > scoreTolerance) {
      console.error("Score mismatch:", {
        client: score,
        server: calculated.score,
        diff: scoreDiff
      });
      return NextResponse.json({ error: "Score validation failed" }, { status: 400 });
    }

    if (calculated.mergeCount !== mergeCount || calculated.highestLevel !== highestLevel) {
      console.error("Stats mismatch:", {
        client: { mergeCount, highestLevel },
        server: calculated
      });
      return NextResponse.json({ error: "Stats validation failed" }, { status: 400 });
    }

    const entry: LeaderboardEntry = {
      fid: user.fid, // ✅ sadece token'dan
      address,
      score: calculated.score,
      mergeCount: calculated.mergeCount,
      highestLevel: calculated.highestLevel,
      playedAt: Date.now()
    };

    await saveScore(mode, entry);

    return NextResponse.json(
      {
        success: true,
        verifiedScore: calculated.score
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
