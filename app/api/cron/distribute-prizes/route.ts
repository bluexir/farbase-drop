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

// Leaderboard.ts ile aynı mantık: UTC Pazartesi 00:00 başlangıç anahtarı
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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const usdcAddressRaw =
      process.env.NEXT_PUBLIC_USDC_ADDRESS || process.env.USDC_ADDRESS;

    if (!privateKey || !contractAddress) {
      return NextResponse.json(
        { error: "DEPLOYER_PRIVATE_KEY or CONTRACT_ADDRESS not set" },
        { status: 500 }
      );
    }

    if (!usdcAddressRaw) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_USDC_ADDRESS (or USDC_ADDRESS) not set" },
        { status: 500 }
      );
    }

    if (!ethers.isAddress(contractAddress)) {
      return NextResponse.json({ error: "Invalid CONTRACT_ADDRESS" }, { status: 500 });
    }

    if (!ethers.isAddress(usdcAddressRaw)) {
      return NextResponse.json({ error: "Invalid USDC address env var" }, { status: 500 });
    }

    const usdcAddress = ethers.getAddress(usdcAddressRaw);

    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    // Pool kontrolü
    const poolBalance: bigint = await contract.getPool(usdcAddress);
    if (poolBalance === BigInt(0)) {
      return NextResponse.json(
        { message: "No pool to distribute", poolBefore: "0" },
        { status: 200 }
      );
    }

    // Aynı hafta ikinci kez dağıtma (idempotent)
    const weekKey = getWeekKey();
    const paidKey = `payout:done:${weekKey}`;
    const alreadyPaid = await redis.get<number>(paidKey);
    if (alreadyPaid) {
      return NextResponse.json(
        { message: "Already distributed for this week", weekKey },
        { status: 200 }
      );
    }

    // Winner adayları: leaderboard top5
    const top5 = await getTop5Tournament();
    const candidateAddrs = (top5 || []).map((x: any) => x?.address).filter(Boolean);

    const winners = uniqValidAddresses(candidateAddrs);

    // Kontrat: "exactly 5 winners" istiyor → 5 yoksa dağıtma
    if (winners.length < 5) {
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

    // Tam 5 winner gönder
    const finalWinners = winners.slice(0, 5);

    const tx = await contract.autoDistributePrizes(usdcAddress, finalWinners);
    const receipt = await tx.wait();

    // Ödeme tamamlandı flag (tekrar dağıtmasın)
    await redis.set(paidKey, 1);

    return NextResponse.json(
      {
        success: true,
        weekKey,
        token: usdcAddress,
        winners: finalWinners,
        txHash: receipt.hash,
        poolBefore: poolBalance.toString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Distribute prizes error:", error);
    return NextResponse.json(
      { error: "Failed to distribute prizes", details: String(error) },
      { status: 500 }
    );
  }
}
