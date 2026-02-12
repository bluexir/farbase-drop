import { ethers } from "ethers";

const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "address[5]", name: "winners", type: "address[5]" },
    ],
    name: "distributePrizes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getPool",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

function getProvider(): ethers.JsonRpcProvider {
  const rpc =
    process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org";
  return new ethers.JsonRpcProvider(rpc);
}

function getContractAddress(): string {
  const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!addr) throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
  return addr;
}

function getUsdcAddress(): string {
  return (
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  );
}

export async function getPoolBalance(): Promise<string> {
  const provider = getProvider();
  const contract = new ethers.Contract(
    getContractAddress(),
    CONTRACT_ABI,
    provider
  );
  const balance = await contract.getPool(getUsdcAddress());
  return ethers.formatUnits(balance, 6);
}

export async function distributePrizes(
  winnerAddresses: [string, string, string, string, string]
): Promise<string> {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("Missing DEPLOYER_PRIVATE_KEY");

  const provider = getProvider();
  const wallet = new ethers.Wallet(key, provider);
  const contract = new ethers.Contract(
    getContractAddress(),
    CONTRACT_ABI,
    wallet
  );

  const tx = await contract.distributePrizes(winnerAddresses);
  const receipt = await tx.wait();
  return receipt.hash;
}
