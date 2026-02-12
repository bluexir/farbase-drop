"use client";

import { getCoinByLevel } from "@/lib/coins";

interface ScoreboardProps {
  score: number;
  mergeCount: number;
  highestLevel: number;
}

export default function Scoreboard({
  score,
  mergeCount,
  highestLevel,
}: ScoreboardProps) {
  const highestCoin = getCoinByLevel(highestLevel);

  return (
    <div className="w-full flex justify-between items-center px-2 py-3">
      <div className="flex flex-col">
        <div className="text-white font-bold text-lg">{score}</div>
        <div className="text-white/60 text-xs">Score</div>
      </div>

      <div className="flex flex-col items-center">
        <div className="text-white font-bold text-lg">{mergeCount}</div>
        <div className="text-white/60 text-xs">Merges</div>
      </div>

      <div className="flex flex-col items-end">
        <div className="text-white font-bold text-lg">
          {highestCoin ? highestCoin.symbol : "?"}
        </div>
        <div className="text-white/60 text-xs">Top coin</div>
      </div>
    </div>
  );
}
