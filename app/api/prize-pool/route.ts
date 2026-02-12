import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  try {
    const raw = await redis.get<string>("tournament:pool:usdc");
    return NextResponse.json(
      {
        amount: raw ?? "0",
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Prize pool error:", e);
    return NextResponse.json(
      { error: "Failed to fetch prize pool" },
      { status: 500 }
    );
  }
}
