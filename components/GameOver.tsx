"use client";

import { getCoinByLevel } from "@/lib/coins";

interface GameOverProps {
  score: number;

  // Eski sürüm uyumu (component bazen mergeCount, bazen merges ile çağrılmış)
  merges?: number;
  mergeCount?: number;

  highestLevel: number;
  scoreSaved: boolean;

  // Yeni akış uyumu
  mode?: "practice" | "tournament";
  onRestart: () => void;
  onMenu?: () => void;

  // SDK cast async olabilir
  onCast: () => void | Promise<void>;
}

export default function GameOver({
  score,
  merges,
  mergeCount,
  highestLevel,
  scoreSaved,
  mode,
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

      {/* Score kaydet durumu */}
      <p
        style={{
          fontSize: "0.7rem",
          color: scoreSaved ? "#00f3ff" : "#555",
          marginBottom: "12px",
        }}
      >
        {scoreSaved ? "✓ Score saved" : "Saving score..."}
      </p>

      {/* Cast Butonu */}
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
        onClick={onRestart}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#eab308",
          border: "none",
          borderRadius: "10px",
          padding: "12px",
          color: "#000",
          fontSize: "0.95rem",
          fontWeight: "bold",
          cursor: "pointer",
          marginBottom: onMenu ? "10px" : "0px",
        }}
      >
        Play Again
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
