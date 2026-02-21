export type Coin = {
  level: number;
  name: string;
  symbol: string;
  radius: number;
  color: string;
  glowColor: string;
  score: number;
  iconUrl: string;
  isSponsor?: boolean;
};

export type Platform = "base" | "farcaster";

export const COINS: Coin[] = [
  {
    level: 1,
    name: "Dogecoin",
    symbol: "DOGE",
    radius: 24,
    color: "#C3A634",
    glowColor: "#C3A63488",
    score: 1,
    iconUrl: "/doge-logo.jpg",
  },
  {
    level: 2,
    name: "Shiba Inu",
    symbol: "SHIB",
    radius: 30,
    color: "#FFA500",
    glowColor: "#FFA50088",
    score: 2,
    iconUrl: "/shib-logo.png",
  },
  {
    level: 3,
    name: "Sponsor",
    symbol: "SPONSOR",
    radius: 39,
    color: "#FF6B6B",
    glowColor: "#FF6B6B88",
    score: 4,
    iconUrl: "",
    isSponsor: true,
  },
  {
    level: 4,
    name: "Pepe",
    symbol: "PEPE",
    radius: 49,
    color: "#00C853",
    glowColor: "#00C85388",
    score: 8,
    iconUrl: "/pepe-logo.png",
  },
  {
    level: 5,
    name: "Solana",
    symbol: "SOL",
    radius: 60,
    color: "#9945FF",
    glowColor: "#9945FF88",
    score: 16,
    iconUrl: "/sol-logo.png",
  },
  {
    level: 6,
    name: "Ethereum",
    symbol: "ETH",
    radius: 72,
    color: "#627EEA",
    glowColor: "#627EEA88",
    score: 32,
    iconUrl: "/eth-logo.png",
  },
  {
    level: 7,
    name: "Bitcoin",
    symbol: "BTC",
    radius: 86,
    color: "#F7931A",
    glowColor: "#F7931A88",
    score: 64,
    iconUrl: "/btc-logo.png",
  },
  {
    level: 8,
    name: "FarBase",
    symbol: "FB",
    radius: 104,
    color: "#0052FF",
    glowColor: "#0052FF88",
    score: 128,
    iconUrl: "/farbase-logo.png",
  },
  {
    level: 9,
    name: "Farcaster",
    symbol: "FARCASTER",
    radius: 120,
    color: "#8A63D2",
    glowColor: "#8A63D288",
    score: 256,
    iconUrl: "/farcaster-logo.png",
  },
];

export function getCoinByLevel(level: number, platform: Platform = "farcaster"): Coin | null {
  const coin = COINS.find((c) => c.level === level) || null;
  if (!coin) return null;

  // ✅ Only override the level-9 coin skin for Base App
  if (level === 9 && platform === "base") {
    return {
      ...coin,
      name: "Coinbase",
      symbol: "COINBASE",
      iconUrl: "/coinbase.png",
      // Coinbase / Base blue theme (premium, consistent)
      color: "#0052FF",
      glowColor: "#0052FF88",
    };
  }

  return coin;
}
