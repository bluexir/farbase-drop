import { NextResponse } from "next/server";
import { saveScore, LeaderboardEntry } from "@/lib/leaderboard";
import { calculateScoreFromLog, validateGameLog, GameLog } from "@/lib/game-log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { 
      fid, 
      address, 
      score, 
      mergeCount, 
      highestLevel, 
      mode,
      gameLog,        // Yeni: Oyun logları
      sessionId       // Yeni: Oyun session ID
    } = body;

    // Temel validasyon
    if (!fid || !address || !mode || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json(
        { error: "Invalid mode" },
        { status: 400 }
      );
    }

    // Game log validasyonu
    const logValidation = validateGameLog(gameLog as GameLog);
    if (!logValidation.valid) {
      console.error("Invalid game log:", logValidation.errors);
      return NextResponse.json(
        { error: "Invalid game data", details: logValidation.errors },
        { status: 400 }
      );
    }

    // Skor doğrulama - Sunucuda yeniden hesapla
    const calculated = calculateScoreFromLog(gameLog as GameLog);
    
    // Tolerans: ±5% (ağ gecikmesi vs. için)
    const scoreDiff = Math.abs(calculated.score - score);
    const scoreTolerance = score * 0.05;
    
    if (scoreDiff > scoreTolerance) {
      console.error("Score mismatch:", {
        client: score,
        server: calculated.score,
        diff: scoreDiff
      });
      return NextResponse.json(
        { error: "Score validation failed" },
        { status: 400 }
      );
    }

    // Merge count ve highest level kontrolü
    if (calculated.mergeCount !== mergeCount || calculated.highestLevel !== highestLevel) {
      console.error("Stats mismatch:", {
        client: { mergeCount, highestLevel },
        server: calculated
      });
      return NextResponse.json(
        { error: "Stats validation failed" },
        { status: 400 }
      );
    }

    // Skor kaydet
    const entry: LeaderboardEntry = {
      fid,
      address,
      score: calculated.score, // Sunucu tarafından hesaplanan skor kullan
      mergeCount: calculated.mergeCount,
      highestLevel: calculated.highestLevel,
      playedAt: Date.now(),
    };

    await saveScore(mode, entry);

    return NextResponse.json({ 
      success: true,
      verifiedScore: calculated.score 
    }, { status: 200 });
    
  } catch (error) {
    console.error("Save score error:", error);
    return NextResponse.json(
      { error: "Failed to save score", details: String(error) },
      { status: 500 }
    );
  }
}
