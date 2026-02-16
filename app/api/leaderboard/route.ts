export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getLeaderboard,
  enrichWithProfiles,
  getPlayerBestScore,
} from "@/lib/leaderboard";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const fidParam = searchParams.get("fid");
    const limitParam = searchParams.get("limit");

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json(
        { error: "Invalid mode. Must be practice or tournament" },
        { status: 400 }
      );
    }

    const fid = fidParam ? Number(fidParam) : null;

    // ✅ default: 500 kişi (istersen ?limit=1000)
    const limit = limitParam ? Number(limitParam) : 500;

    const list = await getLeaderboard(mode, Number.isFinite(limit) ? limit : 500);
    const enriched = await enrichWithProfiles(list);

    const playerBest = fid ? await getPlayerBestScore(mode, fid) : null;

    return NextResponse.json(
      {
        data: enriched,
        playerBest,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
