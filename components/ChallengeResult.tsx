"use client";

import type { Theme } from "@/app/page";
import { Lang, t } from "@/lib/i18n";

type Challenge = {
  id: string;
  creatorFid: number;
  creatorUsername: string;
  creatorScore: number | null;
  targetFid: number | null;
  targetUsername: string | null;
  targetScore: number | null;
  type: "open" | "direct";
  status: "pending" | "accepted" | "completed" | "expired";
  winner: "creator" | "target" | "tie" | null;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
};

interface ChallengeResultProps {
  challenge: Challenge;
  myFid: number;
  theme: Theme;
  lang: Lang;
  onShare: () => void;
  onRematch: () => void;
  onMenu: () => void;
}

export default function ChallengeResult({
  challenge,
  myFid,
  theme,
  lang,
  onShare,
  onRematch,
  onMenu,
}: ChallengeResultProps) {
  const isDark = theme === "dark";

  const isCreator = challenge.creatorFid === myFid;
  const myScore = isCreator ? challenge.creatorScore : challenge.targetScore;
  const opponentScore = isCreator ? challenge.targetScore : challenge.creatorScore;
  const myUsername = isCreator ? challenge.creatorUsername : challenge.targetUsername;
  const opponentUsername = isCreator ? challenge.targetUsername : challenge.creatorUsername;

  const iWon = challenge.winner === (isCreator ? "creator" : "target");
  const isTie = challenge.winner === "tie";

  let resultEmoji = "";
  let resultText = "";
  let resultColor = "";

  if (isTie) {
    resultEmoji = "🤝";
    resultText = t(lang, "challenge.itsTie");
    resultColor = "#eab308";
  } else if (iWon) {
    resultEmoji = "🏆";
    resultText = t(lang, "challenge.youWon");
    resultColor = "#22c55e";
  } else {
    resultEmoji = "😢";
    resultText = t(lang, "challenge.youLost");
    resultColor = "#ef4444";
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: isDark
            ? "radial-gradient(circle at top, rgba(249,115,22,0.15), rgba(0,0,0,0.95))"
            : "radial-gradient(circle at top, rgba(249,115,22,0.1), rgba(255,255,255,0.98))",
          borderRadius: "20px",
          border: isDark ? "1px solid rgba(249,115,22,0.4)" : "1px solid rgba(249,115,22,0.3)",
          padding: "28px 24px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "8px" }}>{resultEmoji}</div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.4rem",
              fontWeight: 900,
              color: resultColor,
            }}
          >
            {resultText}
          </h2>
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "0.85rem",
              color: isDark ? "#888" : "#666",
            }}
          >
            {t(lang, "challenge.challengeResult")}
          </p>
        </div>

        {/* Scores */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "24px",
          }}
        >
          {/* My Score */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: isDark ? "#888" : "#666",
                marginBottom: "4px",
              }}
            >
              {t(lang, "challenge.you")}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                fontWeight: 700,
                color: isDark ? "#fff" : "#1a1a1a",
                marginBottom: "6px",
              }}
            >
              @{myUsername}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 900,
                color: iWon || isTie ? "#22c55e" : isDark ? "#fff" : "#1a1a1a",
              }}
            >
              {myScore ?? 0}
            </p>
          </div>

          {/* VS */}
          <div
            style={{
              padding: "0 16px",
              fontSize: "1rem",
              fontWeight: 900,
              color: "#f97316",
            }}
          >
            {t(lang, "challenge.vs")}
          </div>

          {/* Opponent Score */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: isDark ? "#888" : "#666",
                marginBottom: "4px",
              }}
            >
              &nbsp;
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                fontWeight: 700,
                color: isDark ? "#fff" : "#1a1a1a",
                marginBottom: "6px",
              }}
            >
              @{opponentUsername}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 900,
                color: !iWon && !isTie ? "#22c55e" : isDark ? "#fff" : "#1a1a1a",
              }}
            >
              {opponentScore ?? 0}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Share Result */}
          <button
            onClick={onShare}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🗣️ {t(lang, "challenge.share")}
          </button>

          {/* Rematch */}
          <button
            onClick={onRematch}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #f97316, #fb923c)",
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⚔️ {t(lang, "challenge.rematch")}
          </button>

          {/* Menu */}
          <button
            onClick={onMenu}
            style={{
              width: "100%",
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.1)",
              borderRadius: "12px",
              padding: "14px",
              color: isDark ? "#fff" : "#1a1a1a",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t(lang, "gameover.backToMenu")}
          </button>
        </div>
      </div>
    </div>
  );
}
