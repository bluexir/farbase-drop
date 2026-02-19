import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getTop5Tournament } from "@/lib/leaderboard";

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

const REFERENCE_WEEK_START = new Date("2025-02-04T14:00:00Z").getTime();

function getWeekNumber(): number {
  const now = Date.now();
  const diffMs = now - REFERENCE_WEEK_START;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    // USDC address can be stored either as NEXT_PUBLIC_USDC_ADDRESS or USDC_ADDRESS
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
      return NextResponse.json(
        { error: "Invalid CONTRACT_ADDRESS" },
        { status: 500 }
      );
    }

    if (!ethers.isAddress(usdcAddressRaw)) {
      return NextResponse.json(
        { error: "Invalid USDC address env var" },
        { status: 500 }
      );
    }

    const usdcAddress = ethers.getAddress(usdcAddressRaw);

    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(
      contractAddress,
      CONTRACT_ABI,
      wallet
    );

    // Pool = token balance held by the contract (as defined by getPool)
    const poolBalance: bigint = await contract.getPool(usdcAddress);
    if (poolBalance === 0n) {
      return NextResponse.json(
        { message: "No pool to distribute", pool: "0" },
        { status: 200 }
      );
    }

    const top5 = await getTop5Tournament();

    // IMPORTANT: do NOT pad with ZeroAddress; only include real winners
    const winners = (top5 || [])
      .map((x: any) => x?.address)
      .filter((addr: any) => typeof addr === "string" && ethers.isAddress(addr))
      .map((addr: string) => ethers.getAddress(addr))
      .filter((addr: string) => addr !== ethers.ZeroAddress);

    if (winners.length === 0) {
      return NextResponse.json(
        {
          message: "Pool exists but no winners found (skipping distribution)",
          poolBefore: poolBalance.toString(),
        },
        { status: 200 }
      );
    }

    const weekNumber = getWeekNumber();
    const isFourthWeek = weekNumber % 4 === 0;

    const tx = await contract.autoDistributePrizes(usdcAddress, winners);
    const receipt = await tx.wait();

    return NextResponse.json(
      {
        success: true,
        week: weekNumber,
        isFourthWeek,
        token: usdcAddress,
        winners,
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
