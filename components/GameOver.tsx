"use client";

import { getCoinByLevel, Platform } from "@/lib/coins";
import type { Theme } from "@/app/page";
import { Lang, t } from "@/lib/i18n";

interface GameOverProps {
  score: number;
  lang: Lang;
  merges?: number;
  mergeCount?: number;
  highestLevel: number;
  scoreSaved: boolean;
  scoreSaveError?: string | null;
  mode?: "practice" | "tournament";
  remaining?: number | null;
  isNewBest?: boolean;
  onRestart: () => void;
  onMenu?: () => void;
  onCast: () => void | Promise<void>;
  onChallenge?: () => void | Promise<void>;

  // ✅ New: platform-aware coin labels/icons
  platform?: Platform;
  theme?: Theme;
}

export default function GameOver({
  score,
  lang,
  merges,
  mergeCount,
  highestLevel,
  scoreSaved,
  scoreSaveError,
  mode,
  remaining,
  isNewBest,
  onRestart,
  onMenu,
  onCast,
  onChallenge,
  platform = "farcaster",
  theme = "dark",
}: GameOverProps) {
  const highestCoin = getCoinByLevel(highestLevel, platform);
  const isDark = theme === "dark";

  const mergesValue =
    typeof merges === "number"
      ? merges
      : typeof mergeCount === "number"
      ? mergeCount
      : 0;

  // Practice artık sınırsız - her zaman tekrar oynanabilir
  const canPlayAgain = mode === "practice" || remaining === null || remaining === undefined || remaining > 0;

  // Challenge butonu sadece practice modda ve skor varsa görünür
  const showChallengeButton = mode === "practice" && score > 0 && onChallenge;

  return (
    <div className={`absolute inset-0 ${isDark ? 'bg-black bg-opacity-80' : 'bg-white bg-opacity-90'} flex flex-col items-center justify-center z-10 rounded-xl px-6`}>
      <h2 className="text-3xl font-bold text-red-400 mb-2">{t(lang, 'gameover.title')}</h2>

      {mode ? (
        <p className={`text-xs mb-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {lang === 'tr' ? 'Mod:' : 'Mode:'} <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{mode}</span>
        </p>
      ) : (
        <div className="mb-5" />
      )}

      {isNewBest && (
        <p
          style={{
            color: "#eab308",
            fontSize: "0.8rem",
            fontWeight: 900,
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          {t(lang, 'gameover.newPersonalBest')}
        </p>
      )}

      <div className="w-full bg-gray-800 rounded-lg p-4 mb-4 space-y-3 max-w-md">
        <div className="flex justify-between">
          <span className="text-gray-400">{t(lang, 'gameover.score')}</span>
          <span className="text-yellow-400 font-bold text-lg">{score}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">{t(lang, 'gameover.merges')}</span>
          <span className="text-white font-bold text-lg">{mergesValue}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">{t(lang, 'gameover.bestCoin')}</span>
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

      {/* Score save durumu */}
      <p
        style={{
          fontSize: "0.7rem",
          color: scoreSaved ? "#00f3ff" : scoreSaveError ? "#ef4444" : "#555",
          marginBottom: "12px",
        }}
      >
        {scoreSaved
          ? `✓ ${t(lang, 'gameover.scoreSaved')}`
          : scoreSaveError
          ? `✗ ${scoreSaveError}`
          : "Saving score..."}
      </p>

      {/* Kalan hak - sadece tournament modda göster */}
      {mode === "tournament" && typeof remaining === "number" && (
        <p
          style={{
            fontSize: "0.7rem",
            color: remaining > 0 ? "#888" : "#ef4444",
            marginBottom: "12px",
          }}
        >
          {remaining > 0
            ? t(lang, 'gameover.attemptsRemaining', { count: remaining })
            : t(lang, 'gameover.noAttemptsBuy')}
        </p>
      )}

      {/* Cast */}
      <button
        onClick={() => void onCast()}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          border: "none",
          borderRadius: "10px",
          padding: "12px",
          color: "#fff",
          fontSize: "0.95rem",
          fontWeight: "bold",
          cursor: "pointer",
          marginBottom: "10px",
        }}
      >
        {lang === 'tr' ? '🗣️ Skoru Paylaş' : '🗣️ Cast Score'}
      </button>

      {/* Challenge a Friend - sadece practice modda */}
      {showChallengeButton && (
        <button
          onClick={() => void onChallenge()}
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            border: "none",
            borderRadius: "10px",
            padding: "12px",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          ⚔️ {t(lang, 'gameover.challengeFriend')}
        </button>
      )}

      {/* Play Again */}
      <button
        onClick={canPlayAgain ? onRestart : undefined}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: canPlayAgain ? "#eab308" : "#555",
          border: "none",
          borderRadius: "10px",
          padding: "12px",
          color: canPlayAgain ? "#000" : "#999",
          fontSize: "0.95rem",
          fontWeight: "bold",
          cursor: canPlayAgain ? "pointer" : "not-allowed",
          marginBottom: onMenu ? "10px" : "0px",
        }}
      >
        {canPlayAgain ? t(lang, 'gameover.playAgain') : "No Attempts Left"}
      </button>

      {/* Menu */}
      {onMenu ? (
        <button
          onClick={onMenu}
          style={{
            width: "100%",
            maxWidth: "420px",
            background: isDark ? "#111827" : "#e5e7eb",
            border: isDark ? "1px solid #374151" : "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "12px",
            color: isDark ? "#fff" : "#1f2937",
            fontSize: "0.95rem",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {t(lang, 'gameover.backToMenu')}
        </button>
      ) : null}
    </div>
  );
}
