export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getLeaderboard,
  enrichWithProfiles,
  getPlayerBestScore,
  getAllTournamentArchives,
  getTournamentArchive,
  migratePracticeAllTime,
} from "@/lib/leaderboard";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const type = searchParams.get("type");
    const fidParam = searchParams.get("fid");
    const limitParam = searchParams.get("limit");
    const weekKey = searchParams.get("weekKey");

    // Archive endpoints
    if (type === "archives") {
      // Tüm geçmiş turnuvaları getir
      const archives = await getAllTournamentArchives();
      
      // Her archive için profilleri zenginleştir
      const enrichedArchives = await Promise.all(
        archives.map(async (archive) => ({
          ...archive,
          entries: await enrichWithProfiles(archive.entries),
        }))
      );
      
      return NextResponse.json({ data: enrichedArchives }, { status: 200 });
    }

    if (type === "archive" && weekKey) {
      // Belirli bir turnuvanın archive'ını getir
      const archive = await getTournamentArchive(weekKey);
      if (!archive) {
        return NextResponse.json({ error: "Archive not found" }, { status: 404 });
      }
      
      const enrichedEntries = await enrichWithProfiles(archive.entries);
      return NextResponse.json(
        { data: { ...archive, entries: enrichedEntries } },
        { status: 200 }
      );
    }

    if (type === "migrate-practice") {
      // Practice all-time migration (admin için bir kere çalıştırılacak)
      const result = await migratePracticeAllTime();
      return NextResponse.json(
        { success: true, ...result },
        { status: 200 }
      );
    }

    // Normal leaderboard
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
