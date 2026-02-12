import { NextResponse } from "next/server";
import { requireAdmin, getSettings } from "@/lib/admin";
import { isInvalidTokenError } from "@/lib/quick-auth-server";
import { getTop5Tournament, enrichWithProfiles } from "@/lib/leaderboard";
import { getPoolBalance, distributePrizes } from "@/lib/eth";
import { ethers } from "ethers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const settings = await getSettings();
    const top5Raw = await getTop5Tournament();
    const top5 = await enrichWithProfiles(top5Raw);

    let poolAmount = "0";
    try {
      poolAmount = await getPoolBalance();
    } catch (err) {
      console.error("Pool fetch error:", err);
    }

    const pool = parseFloat(poolAmount);
    const distribution = settings.payoutDistribution;
    const preview = top5.map((entry, i) => ({
      rank: i + 1,
      fid: entry.fid,
      displayName: entry.displayName || `FID: ${entry.fid}`,
      username: entry.username,
      address: entry.address,
      score: entry.score,
      payout:
        distribution[i] !== undefined
          ? ((pool * distribution[i]) / 100).toFixed(2)
          : "0.00",
      percentage: distribution[i] || 0,
    }));

    return NextResponse.json(
      { pool: poolAmount, distribution, winners: preview },
      { status: 200 }
    );
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.includes("not admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin payout GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const top5 = await getTop5Tournament();

    const winners: [string, string, string, string, string] = [
      top5[0]?.address || ethers.ZeroAddress,
      top5[1]?.address || ethers.ZeroAddress,
      top5[2]?.address || ethers.ZeroAddress,
      top5[3]?.address || ethers.ZeroAddress,
      top5[4]?.address || ethers.ZeroAddress,
    ];

    const txHash = await distributePrizes(winners);

    return NextResponse.json(
      { success: true, txHash, winners },
      { status: 200 }
    );
  } catch (e) {
    if (isInvalidTokenError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.includes("not admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin payout POST error:", e);
    return NextResponse.json(
      { error: "Payout failed", details: String(e) },
      { status: 500 }
    );
  }
}
