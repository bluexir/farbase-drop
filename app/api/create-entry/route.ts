import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";
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

    // Tournament: server-side idempotency by purchaseId (prevents double credits on retries)
    const purchaseId = body?.purchaseId;
    if (typeof purchaseId !== "string" || purchaseId.length < 8 || purchaseId.length > 200) {
      return NextResponse.json({ error: "Missing or invalid purchaseId" }, { status: 400 });
    }

    const doneKey = `tournament:purchase:done:${purchaseId}`;
    const lockKey = `tournament:purchase:lock:${purchaseId}`;

    const alreadyDone = await redis.get(doneKey);
    if (alreadyDone) {
      return NextResponse.json({ success: true, alreadyProcessed: true }, { status: 200 });
    }

    // Acquire short lock to avoid double-processing concurrently
    const lock = await redis.set(lockKey, user.fid, { nx: true, ex: 120 });
    if (lock !== "OK") {
      // Another request is processing this purchaseId
      return NextResponse.json({ success: false, processing: true }, { status: 202 });
    }

    try {
      // Add 3 tournament attempts
      await createTournamentEntry(redis, user.fid);

      // Mark done (keep for ~2 weeks)
      await redis.set(doneKey, user.fid, { ex: 60 * 60 * 24 * 14 });
      return NextResponse.json({ success: true }, { status: 200 });
    } finally {
      // Best-effort unlock
      try {
        await redis.del(lockKey);
      } catch {}
    }
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create entry error:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
