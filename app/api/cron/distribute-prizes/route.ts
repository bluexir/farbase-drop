import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getTop5Tournament } from "@/lib/leaderboard";

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "address[5]", name: "winners", type: "address[5]" }],
    name: "distributePrizes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getUSDCPool",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
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

    if (!privateKey || !contractAddress) {
      return NextResponse.json(
        { error: "DEPLOYER_PRIVATE_KEY or CONTRACT_ADDRESS not set" },
        { status: 500 }
      );
    }

    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    const poolBalance = await contract.getUSDCPool();
    if (poolBalance === BigInt(0)) {
      return NextResponse.json({ message: "No pool to distribute" }, { status: 200 });
    }

    const top5 = await getTop5Tournament();

    const winners: string[] = [
      top5[0]?.address || ethers.ZeroAddress,
      top5[1]?.address || ethers.ZeroAddress,
      top5[2]?.address || ethers.ZeroAddress,
      top5[3]?.address || ethers.ZeroAddress,
      top5[4]?.address || ethers.ZeroAddress,
    ];

    const weekNumber = getWeekNumber();
    const isFourthWeek = weekNumber % 4 === 0;

    const tx = await contract.distributePrizes(winners);
    const receipt = await tx.wait();

    return NextResponse.json(
      {
        success: true,
        week: weekNumber,
        isFourthWeek,
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
