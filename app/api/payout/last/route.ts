import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  try {
    const last = await redis.get<any>("payout:last");

    // Henüz hiç dağıtım olmadıysa
    if (!last) {
      return NextResponse.json({ hasPayout: false }, { status: 200 });
    }

    return NextResponse.json(
      {
        hasPayout: true,
        ...last,
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to read last payout", details: String(e) },
      { status: 500 }
    );
  }
}
