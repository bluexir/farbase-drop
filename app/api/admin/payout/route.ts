import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  requireQuickAuthUser,
  isInvalidTokenError,
} from "@/lib/quick-auth-server";
import { isAdmin } from "@/lib/admin";
import { getTop5Tournament, enrichWithProfiles } from "@/lib/leaderboard";
import { getWeekKey } from "@/lib/attempts";
import { sendPayouts } from "@/lib/eth";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SETTINGS_KEY = "admin:settings";

async function getSettings() {
  const s = await redis.get<any>(SETTINGS_KEY);
  if (s) return s;
  return {
    payoutDistribution: [40, 25, 15, 10, 10],
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    if (!isAdmin(user.fid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await getSettings();
    const dist = settings.payoutDistribution || [40, 25, 15, 10, 10];

    const top5 = await getTop5Tournament();
    const enriched = await enrichWithProfiles(top5);

    const weekKey = getWeekKey();
    const poolKey = `tournament:pool:${weekKey}:usdc`;
    const pool = (await redis.get<string>(poolKey)) ?? "0";

    const winners = enriched.slice(0, 5).map((w, idx) => {
      const percentage = dist[idx] ?? 0;
      const payout = ((Number(pool) * percentage) / 100).toFixed(2);
      return {
        rank: idx + 1,
        fid: w.fid,
        address: w.address,
        score: w.score,
        displayName: w.displayName || `FID: ${w.fid}`,
        payout,
        percentage,
      };
    });

    return NextResponse.json(
      {
        preview: {
          pool,
          winners,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin payout GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payout preview" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    if (!isAdmin(user.fid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await getSettings();
    const dist = settings.payoutDistribution || [40, 25, 15, 10, 10];

    const top5 = await getTop5Tournament();
    const enriched = await enrichWithProfiles(top5);

    if (!enriched.length) {
      return NextResponse.json(
        { error: "No winners this week" },
        { status: 400 }
      );
    }

    const weekKey = getWeekKey();
    const poolKey = `tournament:pool:${weekKey}:usdc`;
    const pool = (await redis.get<string>(poolKey)) ?? "0";

    const winners = enriched.slice(0, 5).map((w, idx) => ({
      address: w.address,
      percentage: dist[idx] ?? 0,
      fid: w.fid,
      score: w.score,
    }));

    const txHash = await sendPayouts({
      poolUsdc: pool,
      winners: winners.map((w) => ({
        address: w.address,
        percentage: w.percentage,
      })),
    });

    await redis.set(`tournament:payout:${weekKey}`, {
      txHash,
      at: Date.now(),
      pool,
      winners,
    });

    return NextResponse.json({ ok: true, txHash }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin payout POST error:", error);
    return NextResponse.json(
      { error: "Failed to trigger payout", details: String(error) },
      { status: 500 }
    );
  }
}
