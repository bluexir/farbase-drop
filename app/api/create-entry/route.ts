import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  requireQuickAuthUser,
  isInvalidTokenError,
} from "@/lib/quick-auth-server";
import { createTournamentEntry } from "@/lib/attempts";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function POST(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    const body = await request.json().catch(() => ({}));
    const mode = body?.mode;

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // Practice: gunluk ucretsiz, entry olusturmaya gerek yok
    if (mode === "practice") {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Tournament: 3 hak ekle
    await createTournamentEntry(redis, user.fid);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create entry error:", error);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    );
  }
}
