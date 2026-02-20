"use client";

import { getCoinByLevel } from "@/lib/coins";

interface ScoreboardProps {
  score: number;
  mergeCount: number;
  highestLevel: number;

  // Optional (for tournament UX)
  mode?: "practice" | "tournament";
  remainingAttempts?: number | null;
}

export default function Scoreboard({
  score,
  mergeCount,
  highestLevel,
  mode,
  remainingAttempts,
}: ScoreboardProps) {
  const highestCoin = getCoinByLevel(highestLevel);

  const modeLabel =
    mode === "tournament" ? "Tournament" : mode === "practice" ? "Practice" : null;

  const attemptsLabel =
    mode === "tournament"
      ? `Attempts: ${typeof remainingAttempts === "number" ? remainingAttempts : "—"}`
      : null;

  return (
    <div className="w-full flex justify-between items-center px-2 py-3">
      <div className="flex flex-col">
        <span className="text-gray-500 text-xs uppercase tracking-wide">Score</span>
        <span className="text-yellow-400 text-xl font-bold">{score}</span>

        {(modeLabel || attemptsLabel) && (
          <span className="text-gray-400 text-[11px] mt-1">
            {modeLabel}
            {attemptsLabel ? ` • ${attemptsLabel}` : ""}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center">
        <span className="text-gray-500 text-xs uppercase tracking-wide">Merges</span>
        <span className="text-white text-xl font-bold">{mergeCount}</span>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-gray-500 text-xs uppercase tracking-wide">Best</span>
        <div className="flex items-center gap-1">
          <div
            className="w-5 h-5 rounded-full"
            style={{ backgroundColor: highestCoin?.color || "#C3A634" }}
          />
          <span className="text-white text-xl font-bold">
            {highestCoin?.symbol || "DOGE"}
          </span>
        </div>
      </div>
    </div>
  );
}
