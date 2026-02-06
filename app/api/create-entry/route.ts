import { NextRequest, NextResponse } from "next/server";
import { createNewEntry } from "@/lib/attempts";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);

    const body = await req.json();
    const { address, mode } = body;

    if (!mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // Token’dan gelen FID ile entry oluştur
    const entryId = await createNewEntry(user.fid, address || "", mode);

    return NextResponse.json(
      {
        success: true,
        entryId,
        attemptsRemaining: 3
      },
      { status: 200 }
    );
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create entry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
