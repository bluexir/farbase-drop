"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface MainMenuProps {
  fid: number;
  onPractice: () => void;
  onTournament: () => void;
  onLeaderboard: () => void;
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { token } = await sdk.quickAuth.getToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export default function MainMenu({ fid, onPractice, onTournament, onLeaderboard }: MainMenuProps) {
  const [prizePool, setPrizePool] = useState<string>("0");
  const [recommendedApps, setRecommendedApps] = useState<any[]>([]);
  const [practiceAttempts, setPracticeAttempts] = useState<number>(3);
  const [tournamentAttempts, setTournamentAttempts] = useState<number>(0);

  useEffect(() => {
    async function fetchPrizePool() {
      try {
        const res = await fetch("/api/prize-pool");
        const data = await res.json();
        setPrizePool(data.amount || "0");
      } catch (e) {
        console.error("Failed to fetch prize pool:", e);
      }
    }

    async function fetchRecommendedApps() {
      try {
        const res = await fetch("/recommended-apps.json");
        const data = await res.json();
        setRecommendedApps(data.apps || []);
      } catch (e) {
        console.error("Failed to fetch recommended apps:", e);
      }
    }

    async function fetchAttempts() {
      try {
        const practiceRes = await authFetch(`/api/remaining-attempts?mode=practice`);
        const practiceData = await practiceRes.json();
        setPracticeAttempts(practiceData.remaining ?? 0);

        const tournamentRes = await authFetch(`/api/remaining-attempts?mode=tournament`);
        const tournamentData = await tournamentRes.json();
        setTournamentAttempts(tournamentData.remaining ?? 0);
      } catch (e) {
        console.error("Failed to fetch attempts:", e);
      }
    }

    fetchPrizePool();
    fetchRecommendedApps();
    fetchAttempts();
  }, [fid]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        color: "#fff",
      }}
    >
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: "bold",
          color: "#00f3ff",
          textShadow: "0 0 20px #00f3ff, 0 0 40px #00f3ff44",
          marginBottom: "8px",
          textAlign: "center",
        }}
      >
        FarBase Drop
      </h1>

      <p
        style={{
          color: "#666",
          fontSize: "0.8rem",
          marginBottom: "40px",
          textAlign: "center",
          letterSpacing: "0.05em",
        }}
      >
        Skill-Based Crypto Merge • Base Mainnet
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: "340px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Practice */}
        <div
          onClick={practiceAttempts > 0 ? onPractice : undefined}
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            border: "1px solid #00f3ff",
            borderRadius: "16px",
            padding: "20px",
            cursor: practiceAttempts > 0 ? "pointer" : "not-allowed",
            opacity: practiceAttempts > 0 ? 1 : 0.5,
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (practiceAttempts > 0) {
              e.currentTarget.style.boxShadow = "0 0 20px #00f3ff44";
              e.currentTarget.style.transform = "translateY(-2px)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "1rem", fontWeight: "bold", color: "#00f3ff" }}>
              🎮 Practice
            </span>
            <span
              style={{
                background: practiceAttempts > 0 ? "#fff" : "#555",
                color: practiceAttempts > 0 ? "#000" : "#999",
                fontSize: "0.7rem",
                fontWeight: "bold",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              {practiceAttempts}/3
            </span>
          </div>
          <p style={{ color: "#666", fontSize: "0.75rem", margin: 0 }}>
            Daily free attempts • Same seed • No rewards
          </p>
        </div>

        {/* Tournament */}
        <div
          onClick={onTournament}
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            border: "1px solid #ff00ff",
            borderRadius: "16px",
            padding: "20px",
            cursor: "pointer",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px #ff00ff44";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "1rem", fontWeight: "bold", color: "#ff00ff" }}>
              🏆 Tournament
            </span>
            <span
              style={{
                background: tournamentAttempts > 0 ? "#fff" : "#555",
                color: tournamentAttempts > 0 ? "#000" : "#999",
                fontSize: "0.7rem",
                fontWeight: "bold",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              {tournamentAttempts}/3
            </span>
          </div>
          <p style={{ color: "#666", fontSize: "0.75rem", margin: 0 }}>
            1 USDC Entry • Top 5 Win • 3 attempts per entry
          </p>
        </div>

        {/* Leaderboard */}
        <div
          onClick={onLeaderboard}
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            border: "1px solid #444",
            borderRadius: "16px",
            padding: "20px",
            cursor: "pointer",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px #44444444";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1rem", fontWeight: "bold", color: "#fff" }}>📊 Leaderboard</span>
          </div>
          <p style={{ color: "#666", fontSize: "0.75rem", margin: 0 }}>
            Weekly Top 5 • Practice & Tournament
          </p>
        </div>

        {/* Prize Pool */}
        <div
          style={{
            marginTop: "8px",
            textAlign: "center",
            color: "#9ca3af",
            fontSize: "0.75rem",
          }}
        >
          Prize Pool: <span style={{ color: "#fff", fontWeight: 700 }}>{prizePool}</span> USDC
        </div>

        {/* Recommended Apps */}
        {recommendedApps?.length ? (
          <div style={{ marginTop: "18px" }}>
            <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "8px" }}>
              Recommended Apps
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recommendedApps.map((app, idx) => (
                <a
                  key={idx}
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    textDecoration: "none",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "10px",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.9rem",
                    }}
                  >
                    {app.emoji || "✨"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{app.name}</span>
                    <span style={{ color: "#9ca3af", fontSize: "0.7rem" }}>{app.description}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
