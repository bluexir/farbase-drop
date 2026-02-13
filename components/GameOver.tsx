"use client";

import { getCoinByLevel } from "@/lib/coins";

interface GameOverProps {
  score: number;
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
}

export default function GameOver({
  score,
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
}: GameOverProps) {
  const highestCoin = getCoinByLevel(highestLevel);

  const mergesValue =
    typeof merges === "number"
      ? merges
      : typeof mergeCount === "number"
      ? mergeCount
      : 0;

  const canPlayAgain =
    remaining === null || remaining === undefined || remaining > 0;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-10 rounded-xl px-6">
      <h2 className="text-3xl font-bold text-red-400 mb-2">Game Over</h2>

      {mode ? (
        <p className="text-xs text-gray-400 mb-5">
          Mode: <span className="text-white font-semibold">{mode}</span>
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
          🏅 New Personal Best!
        </p>
      )}

      <div className="w-full bg-gray-800 rounded-lg p-4 mb-4 space-y-3 max-w-md">
        <div className="flex justify-between">
          <span className="text-gray-400">Score</span>
          <span className="text-yellow-400 font-bold text-lg">{score}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Merges</span>
          <span className="text-white font-bold text-lg">{mergesValue}</span>
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

      {/* Score save durumu */}
      <p
        style={{
          fontSize: "0.7rem",
          color: scoreSaved ? "#00f3ff" : scoreSaveError ? "#ef4444" : "#555",
          marginBottom: "12px",
        }}
      >
        {scoreSaved
          ? "✓ Score saved"
          : scoreSaveError
          ? `✗ ${scoreSaveError}`
          : "Saving score..."}
      </p>

      {/* Kalan hak */}
      {typeof remaining === "number" && (
        <p
          style={{
            fontSize: "0.7rem",
            color: remaining > 0 ? "#888" : "#ef4444",
            marginBottom: "12px",
          }}
        >
          {remaining > 0
            ? `${remaining} attempt${remaining !== 1 ? "s" : ""} remaining`
            : mode === "practice"
            ? "No attempts left today — resets at UTC midnight"
            : "No attempts left — buy a new entry to continue"}
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
        🗣️ Cast Score
      </button>

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
        {canPlayAgain ? "Play Again" : "No Attempts Left"}
      </button>

      {/* Menu */}
      {onMenu ? (
        <button
          onClick={onMenu}
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "#111827",
            border: "1px solid #374151",
            borderRadius: "10px",
            padding: "12px",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ⬅️ Back to Menu
        </button>
      ) : null}
    </div>
  );
}
