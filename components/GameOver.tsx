"use client";

import { getCoinByLevel } from "@/lib/coins";

interface GameOverProps {
  score: number;
  mergeCount: number;
  highestLevel: number;
  scoreSaved: boolean;
  scoreSaveError?: string | null;
  mode: "practice" | "tournament";
  remaining: number | null;
  isNewBest?: boolean;
  onRestart: () => void;
  onMenu: () => void;
  onCast: () => void | Promise<void>;
}

export default function GameOver({
  score,
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

  const modeLabel = mode === "tournament" ? "Tournament" : "Practice";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        margin: "0 auto",
        padding: "16px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          "radial-gradient(circle at top, rgba(124,58,237,0.18), rgba(0,0,0,0.9))",
        boxShadow: "0 0 30px rgba(255,0,255,0.12)",
        color: "#fff",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 900, marginBottom: 6 }}>
          Game Over
        </div>
        <div style={{ color: "#888", fontSize: "0.8rem" }}>{modeLabel}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            padding: 12,
          }}
        >
          <div style={{ color: "#888", fontSize: "0.72rem" }}>Score</div>
          <div style={{ fontWeight: 900, fontSize: "1.15rem" }}>{score}</div>
          {isNewBest && (
            <div
              style={{
                marginTop: 6,
                display: "inline-block",
                background: "rgba(0,243,255,0.15)",
                border: "1px solid rgba(0,243,255,0.35)",
                color: "#00f3ff",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: "0.7rem",
                fontWeight: 900,
              }}
            >
              New Best!
            </div>
          )}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            padding: 12,
          }}
        >
          <div style={{ color: "#888", fontSize: "0.72rem" }}>Top coin</div>
          <div style={{ fontWeight: 900, fontSize: "1.15rem" }}>
            {highestCoin ? highestCoin.symbol : "?"}
          </div>
          <div style={{ color: "#666", fontSize: "0.75rem", marginTop: 2 }}>
            Level {highestLevel}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            padding: 12,
            gridColumn: "1 / -1",
          }}
        >
          <div style={{ color: "#888", fontSize: "0.72rem" }}>Merges</div>
          <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>
            {mergeCount}
          </div>
        </div>
      </div>

      {/* Save status */}
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: 12,
          marginBottom: 14,
        }}
      >
        {scoreSaved ? (
          <div style={{ color: "#22c55e", fontWeight: 900, fontSize: "0.85rem" }}>
            ✅ Score saved!
          </div>
        ) : scoreSaveError ? (
          <div style={{ color: "#f87171", fontWeight: 900, fontSize: "0.85rem" }}>
            ❌ {scoreSaveError}
          </div>
        ) : (
          <div style={{ color: "#888", fontSize: "0.85rem" }}>
            Saving score...
          </div>
        )}

        {remaining !== null && (
          <div style={{ color: "#888", marginTop: 6, fontSize: "0.78rem" }}>
            Remaining attempts: <b style={{ color: "#fff" }}>{remaining}</b>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={onRestart}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 14,
            padding: "12px 14px",
            fontWeight: 900,
            cursor: "pointer",
            background: "linear-gradient(90deg, #00f3ff, #7c3aed)",
            color: "#000",
          }}
        >
          Play again
        </button>

        <button
          onClick={onCast}
          style={{
            width: "100%",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 14,
            padding: "12px 14px",
            fontWeight: 900,
            cursor: "pointer",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
          }}
        >
          Share score (cast)
        </button>

        <button
          onClick={onMenu}
          style={{
            width: "100%",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "12px 14px",
            fontWeight: 900,
            cursor: "pointer",
            background: "rgba(255,255,255,0.03)",
            color: "#fff",
          }}
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
