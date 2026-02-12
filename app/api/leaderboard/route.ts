export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getTop5,
  enrichWithProfiles,
  getPlayerBestScore,
} from "@/lib/leaderboard";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const fidParam = searchParams.get("fid");

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'practice' or 'tournament'" },
        { status: 400 }
      );
    }

    const top5 = await getTop5(mode);
    const enriched = await enrichWithProfiles(top5);

    // If fid provided, also return player's personal best
    let playerBest = null;
    if (fidParam) {
      const fid = Number(fidParam);
      if (fid > 0) {
        playerBest = await getPlayerBestScore(mode, fid);
      }
    }

    return NextResponse.json({ data: enriched, playerBest }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard", details: String(error) },
      { status: 500 }
    );
  }
}
