import { NextRequest, NextResponse } from "next/server";
import { getRemainingAttempts } from "@/lib/attempts";
import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireQuickAuthUser(req);

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    if (!mode) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (mode !== "practice" && mode !== "tournament") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    let remaining = 0;

    if (mode === "practice") {
      const today = new Date().toISOString().split("T")[0];
      const dailyKey = `practice:daily:${user.fid}:${today}`;

      const used = (await redis.get<number>(dailyKey)) || 0;
      remaining = Math.max(0, 3 - (typeof used === "number" ? used : 0));
    } else {
      remaining = await getRemainingAttempts(user.fid, mode);
    }

    return NextResponse.json({ remaining, mode }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Remaining attempts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
