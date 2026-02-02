import { NextResponse } from "next/server";
import { sdk } from "@farcaster/miniapp-sdk";
import { saveScore, LeaderboardEntry } from "@/lib/leaderboard";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { fid, address, score, mergeCount, highestLevel, mode } = body;

    // Validasyon
    if (!fid || !address || !score || !mode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'practice' or 'tournament'" },
        { status: 400 }
      );
    }

    // Score kaydet
    const entry: LeaderboardEntry = {
      fid,
      address,
      score,
      mergeCount,
      highestLevel,
      playedAt: Date.now(),
    };

    await saveScore(mode, entry);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Save score error:", error);
    return NextResponse.json(
      { error: "Failed to save score", details: String(error) },
      { status: 500 }
    );
  }
}
