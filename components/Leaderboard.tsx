"use client";

import { useEffect, useState } from "react";
import { getCoinByLevel } from "@/lib/coins";
import type { Theme } from "@/app/page";

interface LeaderboardEntry {
  fid: number;
  address: string;
  score: number;
  mergeCount: number;
  highestLevel: number;
  displayName?: string;
  username?: string;
  pfpUrl?: string;
}

interface TournamentArchive {
  weekKey: string;
  tournamentNumber: number;
  entries: LeaderboardEntry[];
  prizePool?: string;
  winners?: {
    address: string;
    prize: string;
  }[];
  archivedAt: string;
}

interface LeaderboardProps {
  fid: number;
  theme: Theme;
  onBack: () => void;
}

export default function Leaderboard({ fid, theme, onBack }: LeaderboardProps) {
  const [tab, setTab] = useState<"tournament" | "practice">("tournament");
  const [tournamentData, setTournamentData] = useState<LeaderboardEntry[]>([]);
  const [practiceData, setPracticeData] = useState<LeaderboardEntry[]>([]);
  const [archives, setArchives] = useState<TournamentArchive[]>([]);
  const [expandedArchive, setExpandedArchive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme colors
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? 'radial-gradient(circle at center, #0a0a1a 0%, #000 100%)' : 'radial-gradient(circle at center, #ffffff 0%, #f5f5f5 100%)',
    text: isDark ? '#fff' : '#1a1a1a',
    textMuted: isDark ? '#555' : '#888',
    cardBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    border: isDark ? '#333' : '#ddd',
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [tournamentRes, practiceRes, archivesRes] = await Promise.all([
          fetch("/api/leaderboard?mode=tournament"),
          fetch("/api/leaderboard?mode=practice"),
          fetch("/api/leaderboard?type=archives"),
        ]);

        const tournament = await tournamentRes.json();
        const practice = await practiceRes.json();
        const archivesData = await archivesRes.json();

        setTournamentData(tournament.data || []);
        setPracticeData(practice.data || []);
        setArchives(archivesData.data || []);
      } catch (e) {
        console.error("Failed to fetch leaderboard:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const data = tab === "tournament" ? tournamentData : practiceData;
  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32", "#aaa", "#aaa"];

  const renderEntry = (
    entry: LeaderboardEntry,
    index: number,
    isWinner?: boolean,
    prizeAmount?: string
  ) => {
    const coin = getCoinByLevel(entry.highestLevel);
    const isYou = entry.fid === fid;
    const name = entry.displayName || entry.username || `Player ${index + 1}`;

    return (
      <div
        key={`${entry.fid}-${index}`}
        style={{
          display: "flex",
          alignItems: "center",
          background: isYou
            ? "rgba(0,243,255,0.08)"
            : isWinner
            ? "rgba(124,58,237,0.1)"
            : colors.cardBg,
          border: isYou
            ? "1px solid #00f3ff"
            : isWinner
            ? "1px solid rgba(124,58,237,0.5)"
            : index === 0
            ? "1px solid #FFD700"
            : `1px solid ${colors.border}`,
          borderRadius: "12px",
          padding: "12px 16px",
          marginBottom: "8px",
          gap: "12px",
        }}
      >
        {/* Rank */}
        <span
          style={{
            fontSize: "1.2rem",
            fontWeight: "bold",
            color: rankColors[index] || "#aaa",
            minWidth: "28px",
            textAlign: "center",
          }}
        >
          {index < 3 ? ["🥇", "🥈", "🥉"][index] : `${index + 1}.`}
        </span>

        {/* Profile Picture */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            background: isDark ? "#222" : "#ddd",
          }}
        >
          {entry.pfpUrl ? (
            <img
              src={entry.pfpUrl}
              alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.textMuted,
                fontSize: "0.75rem",
                fontWeight: "bold",
              }}
            >
              ?
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <p
              style={{
                color: colors.text,
                fontSize: "0.85rem",
                fontWeight: "bold",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </p>
            {isYou && (
              <span
                style={{
                  background: "#00f3ff",
                  color: "#000",
                  fontSize: "0.6rem",
                  fontWeight: 900,
                  padding: "1px 5px",
                  borderRadius: "6px",
                  flexShrink: 0,
                }}
              >
                You
              </span>
            )}
          </div>
          {entry.username && (
            <p style={{ color: colors.textMuted, fontSize: "0.7rem", margin: "2px 0 0 0" }}>
              {entry.username}
            </p>
          )}
        </div>

        {/* Score + Prize */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: coin?.color || "#C3A634",
              }}
            />
            <span style={{ color: "#eab308", fontWeight: "bold", fontSize: "0.9rem" }}>
              {entry.score}
            </span>
          </div>
          {prizeAmount && (
            <span style={{ color: "#10b981", fontSize: "0.7rem", fontWeight: "bold" }}>
              ${prizeAmount} USDC
            </span>
          )}
        </div>
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
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
          marginBottom: "20px",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#00f3ff",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <span style={{ color: colors.text, fontWeight: "bold", fontSize: "1.1rem" }}>
          📊 Leaderboard
        </span>
        <div style={{ width: "60px" }} />
      </div>

      {/* Tabs */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          width: "100%",
          maxWidth: "424px",
          marginBottom: "20px",
          background: colors.cardBg,
          borderRadius: "12px",
          padding: "4px",
        }}
      >
        <button
          onClick={() => setTab("tournament")}
          style={{
            flex: 1,
            background: tab === "tournament" ? "#7c3aed" : "transparent",
            border: "none",
            borderRadius: "10px",
            color: tab === "tournament" ? "#fff" : colors.text,
            padding: "10px",
            fontSize: "0.85rem",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          🏆 Tournament
        </button>
        <button
          onClick={() => setTab("practice")}
          style={{
            flex: 1,
            background: tab === "practice" ? "#00f3ff" : "transparent",
            border: "none",
            borderRadius: "10px",
            color: tab === "practice" ? "#000" : colors.text,
            padding: "10px",
            fontSize: "0.85rem",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          🎮 Practice
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
            Loading...
          </p>
        ) : tab === "practice" ? (
          // Practice Tab - Sadece liste
          data.length === 0 ? (
            <div
              style={{
                background: colors.cardBg,
                borderRadius: "16px",
                padding: "32px 24px",
                textAlign: "center",
              }}
            >
              <p style={{ color: colors.textMuted, fontSize: "0.85rem" }}>
                No scores yet. Play a game first!
              </p>
            </div>
          ) : (
            data.map((entry, index) => renderEntry(entry, index))
          )
        ) : (
          // Tournament Tab - Bu Hafta + Önceki Turnuvalar
          <>
            {/* Bu Hafta Section */}
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <span style={{ color: "#7c3aed", fontSize: "0.9rem", fontWeight: "bold" }}>
                  📍 This Week
                </span>
                {tournamentData.length > 0 && (
                  <span
                    style={{
                      background: "rgba(124,58,237,0.2)",
                      color: "#a78bfa",
                      fontSize: "0.7rem",
                      padding: "2px 8px",
                      borderRadius: "8px",
                    }}
                  >
                    {tournamentData.length} players
                  </span>
                )}
              </div>

              {tournamentData.length === 0 ? (
                <div
                  style={{
                    background: colors.cardBg,
                    borderRadius: "12px",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ color: colors.textMuted, fontSize: "0.85rem", margin: 0 }}>
                    No entries yet this week.
                  </p>
                </div>
              ) : (
                tournamentData.map((entry, index) => renderEntry(entry, index))
              )}
            </div>

            {/* Önceki Turnuvalar Section */}
            {archives.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ color: "#eab308", fontSize: "0.9rem", fontWeight: "bold" }}>
                    📜 Previous Tournaments
                  </span>
                </div>

                {archives.map((archive) => (
                  <div
                    key={archive.weekKey}
                    style={{
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "12px",
                      marginBottom: "8px",
                      overflow: "hidden",
                    }}
                  >
                    {/* Archive Header - Clickable */}
                    <button
                      onClick={() =>
                        setExpandedArchive(
                          expandedArchive === archive.weekKey ? null : archive.weekKey
                        )
                      }
                      style={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: "#eab308", fontWeight: "bold", fontSize: "0.9rem" }}>
                          🏆 Tournament {archive.tournamentNumber}
                        </span>
                        <span style={{ color: colors.textMuted, fontSize: "0.75rem" }}>
                          {formatDate(archive.archivedAt)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {archive.prizePool && (
                          <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: "bold" }}>
                            ${archive.prizePool}
                          </span>
                        )}
                        <span style={{ color: colors.textMuted, fontSize: "0.8rem" }}>
                          {expandedArchive === archive.weekKey ? "▲" : "▼"}
                        </span>
                      </div>
                    </button>

                    {/* Archive Content - Expanded */}
                    {expandedArchive === archive.weekKey && (
                      <div style={{ padding: "0 12px 12px 12px" }}>
                        {archive.entries.map((entry, index) => {
                          const winner = archive.winners?.find(
                            (w) => w.address.toLowerCase() === entry.address.toLowerCase()
                          );
                          return renderEntry(entry, index, index < 5, winner?.prize);
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
