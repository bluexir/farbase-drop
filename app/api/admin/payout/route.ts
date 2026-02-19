import { NextResponse } from "next/server";
import { requireAdmin, getSettings } from "@/lib/admin";
import { isInvalidTokenError } from "@/lib/quick-auth-server";
import { getTop5Tournament, enrichWithProfiles } from "@/lib/leaderboard";
import { getPoolBalance, distributePrizes } from "@/lib/eth";
import { ethers } from "ethers";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// UTC Pazartesi 00:00 başlangıç anahtarı (weekKey) — cron ile aynı mantık
function getWeekKey() {
  const now = new Date();
  const utc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  const day = utc.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);

  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function uniqValidAddresses(addrs: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const a of addrs) {
    if (!a || typeof a !== "string") continue;
    if (!ethers.isAddress(a)) continue;

    const ca = ethers.getAddress(a);
    if (ca === ethers.ZeroAddress) continue;
    if (seen.has(ca)) continue;

    seen.add(ca);
    out.push(ca);
  }
  return out;
}

type PayoutRecord = {
  weekKey: string;
  token: string;
  winners: string[];
  txHash: string;
  poolBefore: string;
  distributedAt: string; // ISO
  source: "admin";
};

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

    const weekKey = getWeekKey();
    const paidKey = `payout:done:${weekKey}`;
    const alreadyPaid = Boolean(await redis.get<number>(paidKey));

    return NextResponse.json(
      { pool: poolAmount, distribution, winners: preview, weekKey, alreadyPaid },
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const weekKey = getWeekKey();
    const paidKey = `payout:done:${weekKey}`;

    // Idempotent: aynı weekKey için ikinci kez dağıtma
    const alreadyPaid = Boolean(await redis.get<number>(paidKey));
    if (alreadyPaid) {
      return NextResponse.json(
        { success: true, message: "Already distributed for this week", weekKey },
        { status: 200 }
      );
    }

    const top5 = await getTop5Tournament();
    const candidateAddrs = (top5 || [])
      .map((x: any) => x?.address)
      .filter((x: any) => typeof x === "string");

    const winners = uniqValidAddresses(candidateAddrs);

    // Kontrat EXACTLY 5 istiyor → <5 ise dağıtma
    if (winners.length < 5) {
      return NextResponse.json(
        {
          error: "Not enough unique winners yet (need 5).",
          weekKey,
          uniqueWinnersFound: winners.length,
          candidates: candidateAddrs.length,
        },
        { status: 400 }
      );
    }

    const finalWinners: [string, string, string, string, string] = [
      winners[0],
      winners[1],
      winners[2],
      winners[3],
      winners[4],
    ];

    // PoolBefore: UI/record için (fail olursa da payout devam etmeli)
    let poolBefore = "0";
    try {
      poolBefore = await getPoolBalance();
    } catch {}

    const txHash = await distributePrizes(finalWinners);

    const usdcAddress =
      process.env.NEXT_PUBLIC_USDC_ADDRESS ||
      process.env.USDC_ADDRESS ||
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    const record: PayoutRecord = {
      weekKey,
      token: ethers.isAddress(usdcAddress) ? ethers.getAddress(usdcAddress) : usdcAddress,
      winners: finalWinners,
      txHash,
      poolBefore,
      distributedAt: new Date().toISOString(),
      source: "admin",
    };

    // 1) Bu weekKey ödendi (cron tekrar ödemesin)
    await redis.set(paidKey, 1);

    // 2) Bu haftanın kaydı
    await redis.set(`payout:record:${weekKey}`, record);

    // 3) En son dağıtım (UI “Geçen haftanın kazananları” için)
    await redis.set("payout:last", record);

    return NextResponse.json(
      { success: true, txHash, winners: finalWinners, weekKey },
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
