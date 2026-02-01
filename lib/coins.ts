export interface CoinType {
  level: number;
  name: string;
  symbol: string;
  radius: number;
  color: string;
  glowColor: string;
  scoreValue: number;
}

export const COINS: CoinType[] = [
  {
    level: 1,
    name: "Dogecoin",
    symbol: "DOGE",
    radius: 15,
    color: "#C3A634",
    glowColor: "#C3A63488",
    scoreValue: 1,
  },
  {
    level: 2,
    name: "Shiba Inu",
    symbol: "SHIB",
    radius: 22,
    color: "#FFA500",
    glowColor: "#FFA50088",
    scoreValue: 2,
  },
  {
    level: 3,
    name: "Sponsor",
    symbol: "SPO",
    radius: 30,
    color: "#FF6B6B",
    glowColor: "#FF6B6B88",
    scoreValue: 4,
  },
  {
    level: 4,
    name: "Pepe",
    symbol: "PEPE",
    radius: 38,
    color: "#00C853",
    glowColor: "#00C85388",
    scoreValue: 8,
  },
  {
    level: 5,
    name: "Solana",
    symbol: "SOL",
    radius: 47,
    color: "#9945FF",
    glowColor: "#9945FF88",
    scoreValue: 16,
  },
  {
    level: 6,
    name: "Ethereum",
    symbol: "ETH",
    radius: 57,
    color: "#627EEA",
    glowColor: "#627EEA88",
    scoreValue: 32,
  },
  {
    level: 7,
    name: "Bitcoin",
    symbol: "BTC",
    radius: 68,
    color: "#F7931A",
    glowColor: "#F7931A88",
    scoreValue: 64,
  },
];

export function getCoinByLevel(level: number): CoinType | undefined {
  return COINS.find((c) => c.level === level);
}
