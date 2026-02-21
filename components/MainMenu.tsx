"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import HowToPlay from "./HowToPlay";

interface MainMenuProps {
  fid: number | null;
  onPractice: () => void;
  onTournament: () => void;
  onLeaderboard: () => void;
  onAdmin?: () => void;
}

type AttemptsResponse = {
  mode: "practice" | "tournament";
  remaining: number;
  limit: number;
  isAdmin: boolean;
  resetAt: number | null;
  resetInSeconds: number | null;
};

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

async function fetchWithQuickAuth(fid: number | null, url: string, init?: RequestInit) {
  // ✅ Lazy auth: FID yoksa QuickAuth tetikleme (Base preview patlamasın)
  if (!fid) return await fetch(url, init);

  try {
    const { token } = await sdk.quickAuth.getToken();
    return await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (_e) {
    return await fetch(url, init);
  }
}

export default function MainMenu({
  fid,
  onPractice,
  onTournament,
  onLeaderboard,
  onAdmin,
}: MainMenuProps) {
  const [prizePool, setPrizePool] = useState<string>("0");
  const [recommendedApps, setRecommendedApps] = useState<any[]>([]);
  const [practiceAttempts, setPracticeAttempts] = useState<number>(3);
  const [tournamentAttempts, setTournamentAttempts] = useState<number>(0);
  const [practiceResetIn, setPracticeResetIn] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

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
      // ✅ Lazy auth: FID yoksa attempts çekmeyiz (401/SignIn patlaması olmasın)
      if (!fid) {
        // UI’da “explore” için güvenli defaultlar kalsın
        setPracticeAttempts(3);
        setTournamentAttempts(0);
        setPracticeResetIn(null);
        setIsAdmin(false);
        return;
      }

      try {
        const practiceRes = await fetchWithQuickAuth(fid, "/api/remaining-attempts?mode=practice");
        if (practiceRes.ok) {
          const practiceData = (await practiceRes.json()) as AttemptsResponse;
          setPracticeAttempts(typeof practiceData.remaining === "number" ? practiceData.remaining : 3);
          setPracticeResetIn(
            typeof practiceData.resetInSeconds === "number" ? practiceData.resetInSeconds : null
          );
          setIsAdmin(!!practiceData.isAdmin);
        }

        const tournamentRes = await fetchWithQuickAuth(
          fid,
          "/api/remaining-attempts?mode=tournament"
        );
        if (tournamentRes.ok) {
          const tournamentData = (await tournamentRes.json()) as AttemptsResponse;
          setTournamentAttempts(typeof tournamentData.remaining === "number" ? tournamentData.remaining : 0);
          setIsAdmin((prev) => prev || !!tournamentData.isAdmin);
        }
      } catch (e) {
        console.error("Failed to fetch attempts:", e);
      }
    }

    fetchPrizePool();
    fetchRecommendedApps();
    fetchAttempts();
  }, [fid]);

  const practiceClickable = isAdmin || practiceAttempts > 0;

  return (
    <div
      style={{
        height: "100vh",
        overflowY: "auto",
        background: "radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)",
        padding: "24px",
        paddingBottom: "40px",
        color: "#fff",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "340px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "0.2px" }}>
            FarBase Drop
          </div>
          <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
            Skill-based crypto merge on Base
          </div>

          {!fid && (
            <div
              style={{
                marginTop: "10px",
                fontSize: "12px",
                opacity: 0.85,
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Preview mode: sign-in is required for Tournament, Leaderboard, and saving scores.
            </div>
          )}
        </div>

        {/* Prize pool */}
        <div
          style={{
            borderRadius: "14px",
            padding: "14px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "12px", opacity: 0.7 }}>Weekly Prize Pool</div>
          <div style={{ fontSize: "20px", fontWeight: 800, marginTop: "4px" }}>
            {prizePool} USDC
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={() => {
            if (!practiceClickable) return;
            onPractice();
          }}
          style={{
            width: "100%",
            borderRadius: "14px",
            padding: "14px 14px",
            fontWeight: 800,
            fontSize: "15px",
            cursor: practiceClickable ? "pointer" : "not-allowed",
            background: practiceClickable ? "#2563eb" : "rgba(255,255,255,0.10)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            marginBottom: "10px",
          }}
        >
          Practice Mode{" "}
          <span style={{ fontWeight: 700, opacity: 0.85 }}>
            ({practiceAttempts} left{practiceResetIn ? ` • reset in ${formatCountdown(practiceResetIn)}` : ""})
          </span>
        </button>

        <button
          onClick={() => {
            if (!fid) return; // tournament requires sign-in
            onTournament();
          }}
          style={{
            width: "100%",
            borderRadius: "14px",
            padding: "14px 14px",
            fontWeight: 800,
            fontSize: "15px",
            cursor: fid ? "pointer" : "not-allowed",
            background: fid ? "#7c3aed" : "rgba(255,255,255,0.10)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            marginBottom: "10px",
          }}
        >
          Weekly Tournament{" "}
          <span style={{ fontWeight: 700, opacity: 0.85 }}>
            ({fid ? `${tournamentAttempts} entries` : "sign-in required"})
          </span>
        </button>

        <button
          onClick={() => {
            if (!fid) return;
            onLeaderboard();
          }}
          style={{
            width: "100%",
            borderRadius: "14px",
            padding: "14px 14px",
            fontWeight: 800,
            fontSize: "15px",
            cursor: fid ? "pointer" : "not-allowed",
            background: fid ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            marginBottom: "10px",
          }}
        >
          Leaderboard
        </button>

        {onAdmin && isAdmin && fid && (
          <button
            onClick={onAdmin}
            style={{
              width: "100%",
              borderRadius: "14px",
              padding: "12px 14px",
              fontWeight: 800,
              fontSize: "14px",
              cursor: "pointer",
              background: "rgba(255,255,255,0.10)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              marginBottom: "10px",
            }}
          >
            Admin Panel
          </button>
        )}

        <button
          onClick={() => setShowHowToPlay(true)}
          style={{
            width: "100%",
            borderRadius: "14px",
            padding: "12px 14px",
            fontWeight: 800,
            fontSize: "14px",
            cursor: "pointer",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            marginBottom: "14px",
          }}
        >
          How to Play
        </button>

        {/* Recommended Apps (as-is) */}
        {recommendedApps?.length > 0 && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontSize: "12px", opacity: 0.7, marginBottom: "8px" }}>
              Recommended Mini Apps
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recommendedApps.map((app, idx) => (
                <a
                  key={idx}
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    color: "#fff",
                    borderRadius: "12px",
                    padding: "12px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 800, fontSize: "13px" }}>{app.name}</div>
                    <div style={{ fontSize: "12px", opacity: 0.7 }}>{app.description}</div>
                  </div>
                  <div style={{ opacity: 0.7, fontWeight: 800 }}>›</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
    </div>
  );
}
