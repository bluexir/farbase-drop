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

export const COINS: Coin[] = [
  {
    level: 1,
    name: "Dogecoin",
    symbol: "DOGE",
    radius: 18,
    color: "#C3A634",
    glowColor: "#C3A63488",
    score: 1,
    iconUrl: "/doge-logo.jpg",
  },
  {
    level: 2,
    name: "Shiba Inu",
    symbol: "SHIB",
    radius: 26,
    color: "#FFA500",
    glowColor: "#FFA50088",
    score: 2,
    iconUrl: "/shib-logo.png",
  },
  {
    level: 3,
    name: "Sponsor",
    symbol: "SPONSOR",
    radius: 35,
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
    radius: 45,
    color: "#00C853",
    glowColor: "#00C85388",
    score: 8,
    iconUrl: "/pepe-logo.png",
  },
  {
    level: 5,
    name: "Solana",
    symbol: "SOL",
    radius: 56,
    color: "#9945FF",
    glowColor: "#9945FF88",
    score: 16,
    iconUrl: "/sol-logo.png",
  },
  {
    level: 6,
    name: "Ethereum",
    symbol: "ETH",
    radius: 68,
    color: "#627EEA",
    glowColor: "#627EEA88",
    score: 32,
    iconUrl: "/eth-logo.png",
  },
  {
    level: 7,
    name: "Bitcoin",
    symbol: "BTC",
    radius: 82,
    color: "#F7931A",
    glowColor: "#F7931A88",
    score: 64,
    iconUrl: "/btc-logo.png",
  },
  {
    level: 8,
    name: "FarBase",
    symbol: "FB",
    radius: 100,
    color: "#0052FF",
    glowColor: "#0052FF88",
    score: 128,
    iconUrl: "/farbase-logo.png",
  },
];

export function getCoinByLevel(level: number): Coin | null {
  return COINS.find((c) => c.level === level) || null;
}
