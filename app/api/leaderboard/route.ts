import { NextResponse } from "next/server";
import { getTop5 } from "@/lib/leaderboard";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'practice' or 'tournament'" },
        { status: 400 }
      );
    }

    const data = await getTop5(mode);

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard", details: String(error) },
      { status: 500 }
    );
  }
}
