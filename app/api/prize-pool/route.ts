import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const dynamic = "force-dynamic";

const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

function to2Decimals(usdcStr: string) {
  // "1", "1.2", "1.2345" -> "1.00", "1.20", "1.23"
  const [i, d = ""] = usdcStr.split(".");
  return `${i}.${(d + "00").slice(0, 2)}`;
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

    // Base USDC (default) – sende env varsa onu kullanır
    const usdcAddress =
      process.env.NEXT_PUBLIC_USDC_ADDRESS ||
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
    const provider = new ethers.JsonRpcProvider(rpc);

    const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
    const balanceRaw: bigint = await usdc.balanceOf(contractAddress);

    const formatted = ethers.formatUnits(balanceRaw, 6); // USDC 6 decimals
    return NextResponse.json(
      {
        amount: to2Decimals(formatted),
        amountRaw: balanceRaw.toString(),
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
