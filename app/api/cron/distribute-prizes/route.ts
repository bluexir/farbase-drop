import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getTop5Tournament, enrichWithProfiles } from "@/lib/leaderboard";
import { isAdminFid } from "@/lib/admin";
import { sendPayouts } from "@/lib/eth";
import { getWeekKey } from "@/lib/attempts";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  // Vercel cron calls with Authorization: Bearer <CRON_SECRET>
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const top5 = await getTop5Tournament();
    const enriched = await enrichWithProfiles(top5);

    if (!enriched.length) {
      return NextResponse.json(
        { ok: true, message: "No scores to payout this week" },
        { status: 200 }
      );
    }

    // Prize pool: this is server-side UI pool; real pool should come from contract.
    const weekKey = getWeekKey();
    const poolKey = `tournament:pool:${weekKey}:usdc`;
    const pool = (await redis.get<string>(poolKey)) ?? "0";

    // Payout distribution: 40/25/15/10/10 (default)
    const distribution = [40, 25, 15, 10, 10];

    const winners = enriched.slice(0, 5).map((w, idx) => ({
      rank: idx + 1,
      fid: w.fid,
      address: w.address,
      score: w.score,
      displayName: w.displayName || `FID: ${w.fid}`,
      percentage: distribution[idx],
    }));

    // Prevent paying admins (safety)
    const filtered = winners.filter((w) => !isAdminFid(w.fid));

    const txHash = await sendPayouts({
      poolUsdc: pool,
      winners: filtered.map((w) => ({
        address: w.address,
        percentage: w.percentage,
      })),
    });

    // Mark payout done for the week
    await redis.set(`tournament:payout:${weekKey}`, {
      txHash,
      at: Date.now(),
      pool,
      winners: filtered,
    });

    return NextResponse.json(
      {
        ok: true,
        weekKey,
        pool,
        txHash,
        winners: filtered,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("distribute-prizes cron error:", e);
    return NextResponse.json(
      { error: "Failed to distribute prizes", details: String(e) },
      { status: 500 }
    );
  }
}
