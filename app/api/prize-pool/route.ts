import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const dynamic = "force-dynamic";

const CONTRACT_ABI = [
  {
    inputs: [],
    name: "getUSDCPool",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// USDC (6 decimals) -> 2 decimals string (yuvarlama ile)
function formatUSDC2(units6: bigint): string {
  // 6 -> 2 decimal: divide by 10^4 with rounding
 const cents = (units6 + BigInt(5000)) / BigInt(10000);
  const s = cents.toString();
  if (s.length === 1) return `0.0${s}`;
  if (s.length === 2) return `0.${s}`;
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

export async function GET() {
  try {
    const contractAddress =
      process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

    if (!contractAddress) {
      return NextResponse.json(
        { error: "CONTRACT_ADDRESS not set" },
        { status: 500 }
      );
    }

    const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
    const provider = new ethers.JsonRpcProvider(rpc);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

    const poolRaw: bigint = await contract.getUSDCPool();

    return NextResponse.json(
      {
        amount: formatUSDC2(poolRaw),    // UI bununla "$X.XX USDC" gösteriyor
        amountRaw: poolRaw.toString(),   // debug için dursun
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
