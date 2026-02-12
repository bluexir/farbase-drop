"use client";

import { useEffect, useState } from "react";
import { getCoinByLevel } from "@/lib/coins";

interface EnrichedEntry {
  fid: number;
  address: string;
  score: number;
  mergeCount: number;
  highestLevel: number;
  displayName?: string;
  username?: string;
  pfpUrl?: string;
}

interface LeaderboardProps {
  fid: number;
  onBack: () => void;
}

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32", "#888", "#888"];
const RANK_EMOJI = ["🥇", "🥈", "🥉", "4.", "5."];

export default function Leaderboard({ fid, onBack }: LeaderboardProps) {
  const [tab, setTab] = useState<"tournament" | "practice">("tournament");
  const [tournamentData, setTournamentData] = useState<EnrichedEntry[]>([]);
  const [practiceData, setPracticeData] = useState<EnrichedEntry[]>([]);
  const [playerBest, setPlayerBest] = useState<{
    practice: number | null;
    tournament: number | null;
  }>({ practice: null, tournament: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tRes, pRes] = await Promise.all([
          fetch(`/api/leaderboard?mode=tournament&fid=${fid}`),
          fetch(`/api/leaderboard?mode=practice&fid=${fid}`),
        ]);

        const tJson = await tRes.json();
        const pJson = await pRes.json();

        setTournamentData(tJson.data || []);
        setPracticeData(pJson.data || []);
        setPlayerBest({
          tournament: tJson.playerBest?.score ?? null,
          practice: pJson.playerBest?.score ?? null,
        });
      } catch (e) {
        console.error("Leaderboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [fid]);

  const data = tab === "tournament" ? tournamentData : practiceData;
  const myBest =
    tab === "tournament" ? playerBest.tournament : playerBest.practice;

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background:
          "radial-gradient(circle at center, #0a0a1a 0%, #000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
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
        <span
          style={{ color: "#fff", fontWeight: "bold", fontSize: "1.1rem" }}
        >
          📊 Leaderboard
        </span>
        <div style={{ width: "60px" }} />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: "424px",
          marginBottom: "20px",
          background: "rgba(255,255,255,0.05)",
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
            color: "#fff",
            padding: "10px",
            fontSize: "0.85rem",
            fontWeight: "bold",
            cursor: "pointer",
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
            color: tab === "practice" ? "#000" : "#fff",
            padding: "10px",
            fontSize: "0.85rem",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          🎮 Practice
        </button>
      </div>

      {/* List */}
      <div style={{ width: "100%", maxWidth: "424px" }}>
        {loading ? (
          <p
            style={{ color: "#555", textAlign: "center", fontSize: "0.85rem" }}
          >
            Loading...
          </p>
        ) : data.length === 0 ? (
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: "16px",
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#555", fontSize: "0.85rem" }}>
              No scores yet. Play a game first!
            </p>
          </div>
        ) : (
          <>
            {data.map((entry, index) => {
              const coin = getCoinByLevel(entry.highestLevel);
              const isYou = entry.fid === fid;
              return (
                <div
                  key={entry.fid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: isYou
                      ? "rgba(0,243,255,0.08)"
                      : "rgba(255,255,255,0.05)",
                    border: isYou
                      ? "1px solid #00f3ff"
                      : index === 0
                      ? "1px solid #FFD700"
                      : "1px solid #222",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "8px",
                    gap: "10px",
                  }}
                >
                  {/* Rank */}
                  <span
                    style={{
                      fontSize: index < 3 ? "1.3rem" : "1rem",
                      fontWeight: "bold",
                      color: RANK_COLORS[index],
                      minWidth: "32px",
                      textAlign: "center",
                    }}
                  >
                    {RANK_EMOJI[index]}
                  </span>

                  {/* PFP */}
                  {entry.pfpUrl ? (
                    <img
                      src={entry.pfpUrl}
                      alt=""
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid #333",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#333",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        color: "#888",
                        flexShrink: 0,
                      }}
                    >
                      ?
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <p
                        style={{
                          color: "#fff",
                          fontSize: "0.85rem",
                          fontWeight: "bold",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.displayName || `FID: ${entry.fid}`}
                      </p>
                      {isYou && (
                        <span
                          style={{
                            background: "#00f3ff",
                            color: "#000",
                            fontSize: "0.6rem",
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: "8px",
                            flexShrink: 0,
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        color: "#555",
                        fontSize: "0.7rem",
                        margin: "2px 0 0 0",
                      }}
                    >
                      {entry.username ? `@${entry.username}` : ""} ·{" "}
                      {entry.mergeCount} merges
                    </p>
                  </div>

                  {/* Coin + Score */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: coin?.color || "#C3A634",
                      }}
                    />
                    <span
                      style={{
                        color: "#eab308",
                        fontWeight: "bold",
                        fontSize: "0.95rem",
                      }}
                    >
                      {entry.score}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Your best (if not in top 5) */}
            {myBest !== null && !data.some((e) => e.fid === fid) && (
              <div
                style={{
                  marginTop: "12px",
                  background: "rgba(0,243,255,0.06)",
                  border: "1px solid rgba(0,243,255,0.3)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: "#888",
                    fontSize: "0.75rem",
                    margin: 0,
                  }}
                >
                  Your best this week
                </p>
                <p
                  style={{
                    color: "#eab308",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    margin: "4px 0 0 0",
                  }}
                >
                  {myBest}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
