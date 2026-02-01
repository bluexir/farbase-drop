"use client";

import { getCoinByLevel } from "@/lib/coins";

interface GameOverProps {
  score: number;
  mergeCount: number;
  highestLevel: number;
  onRestart: () => void;
}

export default function GameOver({ score, mergeCount, highestLevel, onRestart }: GameOverProps) {
  const highestCoin = getCoinByLevel(highestLevel);

  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-10 rounded-xl px-6">
      <h2 className="text-3xl font-bold text-red-400 mb-6">Game Over</h2>

      <div className="w-full bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-400">Score</span>
          <span className="text-yellow-400 font-bold text-lg">{score}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Merges</span>
          <span className="text-white font-bold text-lg">{mergeCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Best Coin</span>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: highestCoin?.color || "#C3A634" }}
            />
            <span className="text-white font-bold text-lg">
              {highestCoin?.symbol || "DOGE"}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onRestart}
        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg text-lg transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
