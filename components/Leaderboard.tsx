"use client";

import { useEffect, useState } from "react";
import { getCoinByLevel } from "@/lib/coins";

interface LeaderboardEntry {
  fid: number;
  address: string;
  score: number;
  mergeCount: number;
  highestLevel: number;
}

interface LeaderboardProps {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [tab, setTab] = useState<"tournament" | "practice">("tournament");
  const [tournamentData, setTournamentData] = useState<LeaderboardEntry[]>([]);
  const [practiceData, setPracticeData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tournamentRes, practiceRes] = await Promise.all([
          fetch("/api/leaderboard?mode=tournament"),
          fetch("/api/leaderboard?mode=practice"),
        ]);

        const tournament = await tournamentRes.json();
        const practice = await practiceRes.json();

        setTournamentData(tournament.data || []);
        setPracticeData(practice.data || []);
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

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background: "radial-gradient(circle at center, #0a0a1a 0%, #000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
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
        <span style={{ color: "#fff", fontWeight: "bold", fontSize: "1.1rem" }}>
          📊 Leaderboard
        </span>
        <div style={{ width: "60px" }} />
      </div>

      {/* Tabs — Tournament / Practice */}
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
            color: tab === "practice" ? "#000" : "#fff",
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

      {/* List */}
      <div style={{ width: "100%", maxWidth: "424px" }}>
        {loading ? (
          <p style={{ color: "#555", textAlign: "center", fontSize: "0.85rem" }}>Loading...</p>
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
          data.map((entry, index) => {
            const coin = getCoinByLevel(entry.highestLevel);
            return (
              <div
                key={entry.fid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.05)",
                  border: index === 0 ? "1px solid #FFD700" : "1px solid #333",
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
                    color: rankColors[index],
                    minWidth: "28px",
                    textAlign: "center",
                  }}
                >
                  {index + 1}.
                </span>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#fff", fontSize: "0.85rem", fontWeight: "bold", margin: 0 }}>
                    FID: {entry.fid}
                  </p>
                  <p style={{ color: "#555", fontSize: "0.7rem", margin: "2px 0 0 0" }}>
                    {entry.mergeCount} merges
                  </p>
                </div>

                {/* Best Coin + Score */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: coin?.color || "#C3A634",
                    }}
                  />
                  <span style={{ color: "#fff", fontSize: "0.7rem" }}>
                    {coin?.symbol || "DOGE"}
                  </span>
                  <span style={{ color: "#eab308", fontWeight: "bold", fontSize: "0.9rem" }}>
                    {entry.score}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
