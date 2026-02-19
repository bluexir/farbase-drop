import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

type PayoutRecord = {
  weekKey: string;
  token: string;
  winners: unknown; // array expected but keep flexible
  txHash: string;
  poolBefore: string;
  distributedAt: string; // ISO
  source?: "admin" | "cron";
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPayoutRecord(v: unknown): v is PayoutRecord {
  if (!isPlainObject(v)) return false;

  const weekKey = v.weekKey;
  const token = v.token;
  const txHash = v.txHash;
  const poolBefore = v.poolBefore;
  const distributedAt = v.distributedAt;

  if (typeof weekKey !== "string" || weekKey.length < 8) return false;
  if (typeof token !== "string" || token.length < 10) return false;
  if (typeof txHash !== "string" || txHash.length < 10) return false;
  if (typeof poolBefore !== "string") return false;
  if (typeof distributedAt !== "string" || distributedAt.length < 10) return false;

  // winners can be array/object; we won't be strict here
  return true;
}

export async function GET() {
  try {
    const last: unknown = await redis.get("payout:last");

    // Henüz hiç dağıtım olmadıysa
    if (!last) {
      return NextResponse.json({ hasPayout: false }, { status: 200 });
    }

    // Veri bozulduysa / farklı format geldiyse
    if (!isPayoutRecord(last)) {
      return NextResponse.json(
        { hasPayout: false, error: "Invalid payout:last record shape" },
        { status: 200 }
      );
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
