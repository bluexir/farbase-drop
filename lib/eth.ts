import { ethers } from "ethers";

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

function getProvider(): ethers.JsonRpcProvider {
  const rpc =
    process.env.BASE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    "https://mainnet.base.org";
  return new ethers.JsonRpcProvider(rpc);
}

function getContractAddress(): string {
  const addr =
    process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!addr) throw new Error("Missing CONTRACT_ADDRESS (or NEXT_PUBLIC_CONTRACT_ADDRESS)");
  if (!ethers.isAddress(addr)) throw new Error(`Invalid contract address: ${addr}`);
  return ethers.getAddress(addr);
}

function getUsdcAddress(): string {
  const raw =
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    process.env.USDC_ADDRESS ||
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  if (!ethers.isAddress(raw)) throw new Error(`Invalid USDC address: ${raw}`);
  return ethers.getAddress(raw);
}

function getReadContract() {
  const provider = getProvider();
  return new ethers.Contract(getContractAddress(), CONTRACT_ABI, provider);
}

function getWriteContract() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("Missing DEPLOYER_PRIVATE_KEY");
  const provider = getProvider();
  const wallet = new ethers.Wallet(key, provider);
  return new ethers.Contract(getContractAddress(), CONTRACT_ABI, wallet);
}

export async function getPoolBalanceRaw(token?: string): Promise<bigint> {
  const contract = getReadContract();
  const t = token ? ethers.getAddress(token) : getUsdcAddress();
  const balance: bigint = await contract.getPool(t);
  return balance;
}

export async function getPoolBalance(token?: string): Promise<string> {
  const raw = await getPoolBalanceRaw(token);
  // USDC = 6 decimals
  return ethers.formatUnits(raw, 6);
}

/**
 * Low-level payout call.
 * winners must be EXACTLY 5 addresses (contract requirement).
 */
export async function autoDistributePrizes(
  winners: string[],
  token?: string
): Promise<string> {
  if (!Array.isArray(winners)) throw new Error("winners must be an array");
  if (winners.length !== 5) throw new Error("Must have exactly 5 winners");

  const normalized = winners.map((a) => {
    if (!ethers.isAddress(a)) throw new Error(`Invalid winner address: ${a}`);
    const ca = ethers.getAddress(a);
    if (ca === ethers.ZeroAddress) throw new Error("ZeroAddress is not allowed");
    return ca;
  });

  const contract = getWriteContract();
  const t = token ? ethers.getAddress(token) : getUsdcAddress();

  const tx = await contract.autoDistributePrizes(t, normalized);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Backward-compatible name used in admin route.
 * Uses USDC by default.
 */
export async function distributePrizes(
  winnerAddresses: [string, string, string, string, string]
): Promise<string> {
  return autoDistributePrizes([...winnerAddresses]);
}
