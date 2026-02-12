export type Coin = {
  level: number;
  name: string;
  symbol: string;
  color: string;
  score: number;
};

export const COINS: Coin[] = [
  { level: 1, name: "ETH", symbol: "Ξ", color: "#7c3aed", score: 2 },
  { level: 2, name: "BTC", symbol: "₿", color: "#eab308", score: 5 },
  { level: 3, name: "SPONSOR", symbol: "$", color: "#FF6B6B", score: 12 },
  { level: 4, name: "SOL", symbol: "◎", color: "#22c55e", score: 25 },
  { level: 5, name: "DOGE", symbol: "Ð", color: "#f97316", score: 55 },
  { level: 6, name: "SHIB", symbol: "🐶", color: "#ef4444", score: 120 },
  { level: 7, name: "PEPE", symbol: "🐸", color: "#10b981", score: 260 },
  { level: 8, name: "BASE", symbol: "🔵", color: "#00f3ff", score: 600 },
];

export function getCoinByLevel(level: number) {
  return COINS.find((c) => c.level === level) || null;
}
