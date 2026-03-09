"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Theme } from "@/app/page";
import { Lang, t } from "@/lib/i18n";
import { Platform } from "@/lib/coins";

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

type ChallengeStats = {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

interface ChallengeListProps {
  fid: number;
  theme: Theme;
  lang: Lang;
  platform: Platform;
  onBack: () => void;
  onNewChallenge: () => void;
  onAcceptChallenge: (challenge: Challenge) => void;
  onRematch: (opponentUsername: string) => void;
}

function formatTimeLeft(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;
  if (diff <= 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ChallengeList({
  fid,
  theme,
  lang,
  platform,
  onBack,
  onNewChallenge,
  onAcceptChallenge,
  onRematch,
}: ChallengeListProps) {
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isDark = theme === "dark";
  const colors = {
    bg: isDark
      ? "radial-gradient(circle at center, #0a0a1a 0%, #000 100%)"
      : "radial-gradient(circle at center, #ffffff 0%, #f5f5f5 100%)",
    text: isDark ? "#fff" : "#1a1a1a",
    textMuted: isDark ? "#888" : "#666",
    cardBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    border: isDark ? "#333" : "#ddd",
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [challengesRes, statsRes] = await Promise.all([
          sdk.quickAuth.fetch("/api/challenge/list?filter=all"),
          sdk.quickAuth.fetch("/api/challenge/stats"),
        ]);

        if (challengesRes.ok) {
          const data = await challengesRes.json();
          setChallenges(data.challenges || []);
        }

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Failed to fetch challenges:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Filtrele
  const pendingChallenges = challenges.filter((c) => c.status === "pending");
  const completedChallenges = challenges.filter((c) => c.status === "completed" || c.status === "expired");

  // Incoming ve Sent ayır
  const incomingChallenges = pendingChallenges.filter((c) => {
    if (c.type === "direct" && c.targetFid === fid) return true;
    if (c.type === "open" && c.creatorFid !== fid) return true;
    return false;
  });

  const sentChallenges = pendingChallenges.filter((c) => c.creatorFid === fid);

  const displayChallenges = tab === "pending" ? pendingChallenges : completedChallenges;

  const renderChallenge = (challenge: Challenge) => {
    const isCreator = challenge.creatorFid === fid;
    const isIncoming = !isCreator && challenge.status === "pending";

    const opponentUsername = isCreator ? challenge.targetUsername : challenge.creatorUsername;
    const opponentScore = isCreator ? challenge.targetScore : challenge.creatorScore;
    const myScore = isCreator ? challenge.creatorScore : challenge.targetScore;

    let statusColor = "#888";
    let statusText = "";
    let statusIcon = "";

    if (challenge.status === "pending") {
      if (isIncoming) {
        statusColor = "#f97316";
        statusIcon = "📥";
        statusText = t(lang, "challenge.incoming");
      } else {
        statusColor = "#3b82f6";
        statusIcon = "📤";
        statusText = t(lang, "challenge.waiting");
      }
    } else if (challenge.status === "completed") {
      const iWon = challenge.winner === (isCreator ? "creator" : "target");
      const isTie = challenge.winner === "tie";
      if (isTie) {
        statusColor = "#eab308";
        statusIcon = "🤝";
        statusText = "Tie";
      } else if (iWon) {
        statusColor = "#22c55e";
        statusIcon = "🏆";
        statusText = t(lang, "challenge.won");
      } else {
        statusColor = "#ef4444";
        statusIcon = "😢";
        statusText = t(lang, "challenge.lost");
      }
    } else if (challenge.status === "expired") {
      statusColor = "#666";
      statusIcon = "⏰";
      statusText = t(lang, "challenge.expired");
    }

    return (
      <div
        key={challenge.id}
        style={{
          background: colors.cardBg,
          border: `1px solid ${isIncoming ? "#f97316" : colors.border}`,
          borderRadius: "14px",
          padding: "14px 16px",
          marginBottom: "10px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.1rem" }}>{statusIcon}</span>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: statusColor,
              }}
            >
              {statusText}
            </span>
          </div>
          {challenge.status === "pending" && (
            <span
              style={{
                fontSize: "0.7rem",
                color: colors.textMuted,
              }}
            >
              {formatTimeLeft(challenge.expiresAt)} {t(lang, "challenge.timeLeft", { time: "" }).replace("{{time}}", "").trim()}
            </span>
          )}
          {challenge.status === "completed" && (
            <span
              style={{
                fontSize: "0.7rem",
                color: colors.textMuted,
              }}
            >
              {formatDate(challenge.completedAt || challenge.createdAt)}
            </span>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                fontWeight: 700,
                color: colors.text,
              }}
            >
              {isCreator ? (
                challenge.type === "open" ? (
                  <span style={{ color: "#a855f7" }}>Open Challenge</span>
                ) : (
                  <>vs @{opponentUsername}</>
                )
              ) : (
                <>vs @{challenge.creatorUsername}</>
              )}
            </p>
            {challenge.status === "completed" && (
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "0.8rem",
                  color: colors.textMuted,
                }}
              >
                {myScore ?? 0} - {opponentScore ?? 0}
              </p>
            )}
            {challenge.status === "pending" && challenge.creatorScore !== null && (
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "0.8rem",
                  color: colors.textMuted,
                }}
              >
                {t(lang, "challenge.beat")} {challenge.creatorScore} {t(lang, "challenge.points")}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px" }}>
            {isIncoming && challenge.status === "pending" && (
              <button
                onClick={() => onAcceptChallenge(challenge)}
                style={{
                  background: "linear-gradient(135deg, #f97316, #fb923c)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t(lang, "challenge.acceptChallenge")}
              </button>
            )}
            {challenge.status === "completed" && opponentUsername && (
              <button
                onClick={() => onRematch(opponentUsername)}
                style={{
                  background: isDark ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.1)",
                  border: "1px solid rgba(249,115,22,0.4)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  color: "#f97316",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t(lang, "challenge.rematch")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: "424px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#f97316",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          {t(lang, "leaderboard.back")}
        </button>
        <span style={{ color: colors.text, fontWeight: "bold", fontSize: "1.1rem" }}>
          ⚔️ {t(lang, "challenge.title")}
        </span>
        <div style={{ width: "60px" }} />
      </div>

      {/* Stats */}
      {stats && (
        <div
          style={{
            flexShrink: 0,
            width: "100%",
            maxWidth: "424px",
            display: "flex",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, color: "#22c55e" }}>
              {stats.wins}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.7rem", color: colors.textMuted }}>
              {t(lang, "challenge.wins")}
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, color: "#ef4444" }}>
              {stats.losses}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.7rem", color: colors.textMuted }}>
              {t(lang, "challenge.losses")}
            </p>
          </div>
        </div>
      )}

      {/* New Challenge Button */}
      <div
        style={{
          flexShrink: 0,
          width: "100%",
          maxWidth: "424px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={onNewChallenge}
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
          + {t(lang, "challenge.newChallenge")}
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          width: "100%",
          maxWidth: "424px",
          marginBottom: "16px",
          background: colors.cardBg,
          borderRadius: "12px",
          padding: "4px",
        }}
      >
        <button
          onClick={() => setTab("pending")}
          style={{
            flex: 1,
            background: tab === "pending" ? "#f97316" : "transparent",
            border: "none",
            borderRadius: "10px",
            color: tab === "pending" ? "#fff" : colors.text,
            padding: "10px",
            fontSize: "0.85rem",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          {t(lang, "challenge.pending")} ({pendingChallenges.length})
        </button>
        <button
          onClick={() => setTab("completed")}
          style={{
            flex: 1,
            background: tab === "completed" ? "#f97316" : "transparent",
            border: "none",
            borderRadius: "10px",
            color: tab === "completed" ? "#fff" : colors.text,
            padding: "10px",
            fontSize: "0.85rem",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          {t(lang, "challenge.completed")} ({completedChallenges.length})
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          width: "100%",
          maxWidth: "424px",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "16px",
        }}
      >
        {loading ? (
          <p style={{ color: colors.textMuted, textAlign: "center", fontSize: "0.85rem" }}>
            {t(lang, "common.loading")}
          </p>
        ) : displayChallenges.length === 0 ? (
          <div
            style={{
              background: colors.cardBg,
              borderRadius: "16px",
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: colors.textMuted, fontSize: "0.85rem", margin: 0 }}>
              {t(lang, "challenge.noChallenges")}
            </p>
            <p style={{ color: colors.textMuted, fontSize: "0.8rem", marginTop: "8px" }}>
              {t(lang, "challenge.startFirst")}
            </p>
          </div>
        ) : (
          <>
            {/* Incoming section (only in pending tab) */}
            {tab === "pending" && incomingChallenges.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#f97316",
                    marginBottom: "10px",
                  }}
                >
                  📥 {t(lang, "challenge.incoming")} ({incomingChallenges.length})
                </p>
                {incomingChallenges.map(renderChallenge)}
              </div>
            )}

            {/* Sent section (only in pending tab) */}
            {tab === "pending" && sentChallenges.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#3b82f6",
                    marginBottom: "10px",
                  }}
                >
                  📤 {t(lang, "challenge.sent")} ({sentChallenges.length})
                </p>
                {sentChallenges.map(renderChallenge)}
              </div>
            )}

            {/* Completed section */}
            {tab === "completed" && completedChallenges.map(renderChallenge)}
          </>
        )}
      </div>
    </div>
  );
}
