import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Redis } from "@upstash/redis";
import { getTop5Tournament } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getPool",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "address[]", name: "winners", type: "address[]" },
    ],
    name: "autoDistributePrizes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// UTC Pazartesi 00:00 başlangıç anahtarı (hafta key)
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

// Log helper (tek satır, okunabilir)
function log(tag: string, data: Record<string, any>) {
  console.log(`[cron:distribute] ${tag}`, data);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log("unauthorized", {});
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const weekKey = getWeekKey(); // loglarda her zaman görünsün diye try dışına aldım

  try {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const usdcAddressRaw =
      process.env.NEXT_PUBLIC_USDC_ADDRESS || process.env.USDC_ADDRESS;

    log("start", { weekKey });

    if (!privateKey || !contractAddress) {
      log("missing_env", { weekKey, missing: "DEPLOYER_PRIVATE_KEY/CONTRACT_ADDRESS" });
      return NextResponse.json(
        { error: "DEPLOYER_PRIVATE_KEY or CONTRACT_ADDRESS not set" },
        { status: 500 }
      );
    }

    if (!usdcAddressRaw) {
      log("missing_env", { weekKey, missing: "NEXT_PUBLIC_USDC_ADDRESS/USDC_ADDRESS" });
      return NextResponse.json(
        { error: "NEXT_PUBLIC_USDC_ADDRESS (or USDC_ADDRESS) not set" },
        { status: 500 }
      );
    }

    if (!ethers.isAddress(contractAddress)) {
      log("bad_env", { weekKey, field: "CONTRACT_ADDRESS", value: contractAddress });
      return NextResponse.json(
        { error: "Invalid CONTRACT_ADDRESS" },
        { status: 500 }
      );
    }

    if (!ethers.isAddress(usdcAddressRaw)) {
      log("bad_env", { weekKey, field: "USDC_ADDRESS", value: usdcAddressRaw });
      return NextResponse.json(
        { error: "Invalid USDC address env var" },
        { status: 500 }
      );
    }

    const usdcAddress = ethers.getAddress(usdcAddressRaw);

    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    // Pool kontrolü
    const poolBalance: bigint = await contract.getPool(usdcAddress);
    log("pool_checked", {
      weekKey,
      token: usdcAddress,
      poolBefore: poolBalance.toString(),
    });

    if (poolBalance === BigInt(0)) {
      log("skip_no_pool", { weekKey });
      return NextResponse.json(
        { message: "No pool to distribute", weekKey, poolBefore: "0" },
        { status: 200 }
      );
    }

    // Idempotent: aynı hafta 2. kez dağıtma
    const paidKey = `payout:done:${weekKey}`;
    const alreadyPaid = await redis.get<number>(paidKey);
    log("paid_check", { weekKey, paidKey, alreadyPaid: Boolean(alreadyPaid) });

    if (alreadyPaid) {
      log("skip_already_paid", { weekKey });
      return NextResponse.json(
        { message: "Already distributed for this week", weekKey },
        { status: 200 }
      );
    }

    // Winner adayları: leaderboard top5
    const top5 = await getTop5Tournament();
    const candidateAddrs = (top5 || [])
      .map((x: any) => x?.address)
      .filter((x: any) => typeof x === "string");

    const winners = uniqValidAddresses(candidateAddrs);

    log("winners_collected", {
      weekKey,
      candidates: candidateAddrs.length,
      uniqueValid: winners.length,
      winnersPreview: winners, // 5 adres max; loglamak güvenli
    });

    // Kontrat: EXACTLY 5 winners istiyor
    if (winners.length < 5) {
      log("skip_need_5", {
        weekKey,
        uniqueWinnersFound: winners.length,
        poolBefore: poolBalance.toString(),
      });
      return NextResponse.json(
        {
          message: "Not enough unique winners yet (need 5). Skipping distribution.",
          weekKey,
          uniqueWinnersFound: winners.length,
          poolBefore: poolBalance.toString(),
        },
        { status: 200 }
      );
    }

    const finalWinners = winners.slice(0, 5);

    log("tx_sending", { weekKey, token: usdcAddress, finalWinners });

    const tx = await contract.autoDistributePrizes(usdcAddress, finalWinners);
    log("tx_sent", { weekKey, txHash: tx.hash });

    const receipt = await tx.wait();
    log("tx_mined", { weekKey, txHash: receipt.hash });

    // ödeme tamamlandı flag
    await redis.set(paidKey, 1);
    log("paid_marked", { weekKey, paidKey });

    const durationMs = Date.now() - startedAt;
    log("success", { weekKey, durationMs });

    return NextResponse.json(
      {
        success: true,
        weekKey,
        token: usdcAddress,
        winners: finalWinners,
        txHash: receipt.hash,
        poolBefore: poolBalance.toString(),
        durationMs,
      },
      { status: 200 }
    );
  } catch (error) {
    log("error", { weekKey, details: String(error) });
    console.error("Distribute prizes error:", error);
    return NextResponse.json(
      { error: "Failed to distribute prizes", weekKey, details: String(error) },
      { status: 500 }
    );
  }
}
