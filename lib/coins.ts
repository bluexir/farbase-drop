export interface CoinType {
  level: number;
  name: string;
  symbol: string;
  radius: number;
  color: string;
  glowColor: string;
  scoreValue: number;
  iconUrl: string;
  isSponsor?: boolean;
}

export const COINS: CoinType[] = [
  {
    level: 1,
    name: "Dogecoin",
    symbol: "DOGE",
    radius: 18, // Biraz büyütüldü
    color: "#C3A634",
    glowColor: "#C3A63488",
    scoreValue: 1,
    iconUrl: "/doge-logo.jpg",
  },
  {
    level: 2,
    name: "Shiba Inu",
    symbol: "SHIB",
    radius: 26, // Biraz büyütüldü
    color: "#FFA500",
    glowColor: "#FFA50088",
    scoreValue: 2,
    iconUrl: "/shib-logo.png",
  },
  {
    level: 3,
    name: "Pepe",
    symbol: "PEPE",
    radius: 35,
    color: "#00C853",
    glowColor: "#00C85388",
    scoreValue: 4,
    iconUrl: "/pepe-logo.png",
  },
  {
    level: 4,
    name: "Solana",
    symbol: "SOL",
    radius: 45,
    color: "#9945FF",
    glowColor: "#9945FF88",
    scoreValue: 8,
    iconUrl: "/sol-logo.png",
  },
  {
    level: 5,
    name: "Ethereum",
    symbol: "ETH",
    radius: 56,
    color: "#627EEA",
    glowColor: "#627EEA88",
    scoreValue: 16,
    iconUrl: "/eth-logo.png",
  },
  {
    level: 6,
    name: "Bitcoin",
    symbol: "BTC",
    radius: 68,
    color: "#F7931A",
    glowColor: "#F7931A88",
    scoreValue: 32,
    iconUrl: "/btc-logo.png",
  },
  {
    level: 7,
    name: "USDC",
    symbol: "USDC",
    radius: 82,
    color: "#2775CA",
    glowColor: "#2775CA88",
    scoreValue: 64,
    iconUrl: "/usdc-logo.png",
  },
  {
    level: 8,
    name: "FarBase",
    symbol: "FB",
    radius: 100, // EN BÜYÜK TOP
    color: "#0052FF",
    glowColor: "#0052FFBB",
    scoreValue: 128, // EN YÜKSEK PUAN
    iconUrl: "/farbase-logo.png", // GitHub'a yüklediğin isimle aynı olmalı
  },
];

export function getCoinByLevel(level: number): CoinType | undefined {
  return COINS.find((c) => c.level === level);
}
