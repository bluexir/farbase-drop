"use client";

import { getCoinByLevel, Platform } from "@/lib/coins";
import type { Theme } from "@/app/page";

type Lang = "en" | "tr";

interface ScoreboardProps {
  score: number;
  mergeCount: number;
  highestLevel: number;

  mode?: "practice" | "tournament";
  remainingAttempts?: number | null;

  platform?: Platform;
  theme?: Theme;

  // ✅ eklendi
  lang?: Lang;
}

export default function Scoreboard({
  score,
  mergeCount,
  highestLevel,
  mode,
  remainingAttempts,
  platform = "farcaster",
  theme = "dark",
  lang = "en", // ✅ default
}: ScoreboardProps) {
  const highestCoin = getCoinByLevel(highestLevel, platform);
  const isDark = theme === "dark";

  const t = {
    score: lang === "tr" ? "Puan" : "Score",
    merges: lang === "tr" ? "Birleştirme" : "Merges",
    best: lang === "tr" ? "En İyi" : "Best",
    tournament: lang === "tr" ? "Turnuva" : "Tournament",
    practice: lang === "tr" ? "Antrenman" : "Practice",
    attempts: lang === "tr" ? "Hak" : "Attempts",
  };

  const modeLabel =
    mode === "tournament"
      ? t.tournament
      : mode === "practice"
        ? t.practice
        : null;

  const attemptsLabel =
    mode === "tournament"
      ? `${t.attempts}: ${typeof remainingAttempts === "number" ? remainingAttempts : "—"}`
      : null;

  return (
    <div className="w-full flex justify-between items-center px-2 py-3">
      <div className="flex flex-col">
        <span
          className={`text-xs uppercase tracking-wide ${
            isDark ? "text-gray-500" : "text-gray-600"
          }`}
        >
          {t.score}
        </span>
        <span className="text-yellow-400 text-xl font-bold">{score}</span>

        {(modeLabel || attemptsLabel) && (
          <span
            className={`text-[11px] mt-1 ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {modeLabel}
            {attemptsLabel ? ` • ${attemptsLabel}` : ""}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center">
        <span
          className={`text-xs uppercase tracking-wide ${
            isDark ? "text-gray-500" : "text-gray-600"
          }`}
        >
          {t.merges}
        </span>
        <span className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          {mergeCount}
        </span>
      </div>

      <div className="flex flex-col items-end">
        <span
          className={`text-xs uppercase tracking-wide ${
            isDark ? "text-gray-500" : "text-gray-600"
          }`}
        >
          {t.best}
        </span>
        <div className="flex items-center gap-1">
          <div
            className="w-5 h-5 rounded-full"
            style={{ backgroundColor: highestCoin?.color || "#C3A634" }}
          />
          <span className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {highestCoin?.symbol || "DOGE"}
          </span>
        </div>
      </div>
    </div>
  );
}
