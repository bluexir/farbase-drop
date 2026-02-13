'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import HowToPlay from './HowToPlay';

interface MainMenuProps {
  fid: number;
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

async function fetchWithQuickAuth(url: string, init?: RequestInit) {
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
      try {
        const practiceRes = await fetchWithQuickAuth("/api/remaining-attempts?mode=practice");
        if (practiceRes.ok) {
          const practiceData = (await practiceRes.json()) as AttemptsResponse;
          setPracticeAttempts(
            typeof practiceData.remaining === "number" ? practiceData.remaining : 3
          );
          setPracticeResetIn(
            typeof practiceData.resetInSeconds === "number" ? practiceData.resetInSeconds : null
          );
          setIsAdmin(!!practiceData.isAdmin);
        }

        const tournamentRes = await fetchWithQuickAuth("/api/remaining-attempts?mode=tournament");
        if (tournamentRes.ok) {
          const tournamentData = (await tournamentRes.json()) as AttemptsResponse;
          setTournamentAttempts(
            typeof tournamentData.remaining === "number" ? tournamentData.remaining : 0
          );
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
        height: '100vh',
        overflowY: 'auto',
        background: 'radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)',
        padding: '24px',
        paddingBottom: '40px',
        color: '#fff',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        {/* Header with How to Play */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            marginBottom: '8px',
          }}
        >
          <h1
            style={{
              fontSize: '2.2rem',
              fontWeight: 'bold',
              color: '#00f3ff',
              textShadow: '0 0 20px #00f3ff, 0 0 40px #00f3ff44',
              textAlign: 'center',
              margin: 0,
            }}
          >
            FarBase Drop
          </h1>
          <button
            onClick={() => setShowHowToPlay(true)}
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ?
          </button>
        </div>

        <p
          style={{
            color: '#666',
            fontSize: '0.8rem',
            marginBottom: '20px',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          Skill-Based Crypto Merge • Base Mainnet
        </p>

        {/* Admin shortcut */}
        {isAdmin && onAdmin && (
          <button
            onClick={onAdmin}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(0,243,255,0.35)',
              borderRadius: '14px',
              padding: '12px 14px',
              color: '#00f3ff',
              fontWeight: 800,
              cursor: 'pointer',
              marginBottom: '14px',
            }}
          >
            ⚙️ Admin Panel
          </button>
        )}

        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Practice */}
          <div
            onClick={practiceClickable ? onPractice : undefined}
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid #00f3ff',
              borderRadius: '16px',
              padding: '18px',
              cursor: practiceClickable ? 'pointer' : 'not-allowed',
              opacity: practiceClickable ? 1 : 0.55,
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (practiceClickable) {
                e.currentTarget.style.boxShadow = '0 0 20px #00f3ff44';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#00f3ff' }}>
                🎮 Practice
              </span>
              <span
                style={{
                  background: practiceClickable ? '#fff' : '#555',
                  color: practiceClickable ? '#000' : '#999',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {isAdmin ? "∞" : `${practiceAttempts}/3`}
              </span>
            </div>

            <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>
              {isAdmin
                ? "Admin test • Unlimited attempts"
                : practiceAttempts > 0
                  ? "Daily free attempts • No rewards"
                  : `No attempts left • Resets in ${practiceResetIn ? formatCountdown(practiceResetIn) : "soon"}`}
            </p>
          </div>

          {/* Tournament */}
          <div
            onClick={onTournament}
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid #ff00ff',
              borderRadius: '16px',
              padding: '18px',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px #ff00ff44';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#ff00ff' }}>
                🏆 Tournament
              </span>
              <span
                style={{
                  background: tournamentAttempts > 0 || isAdmin ? '#fff' : '#555',
                  color: tournamentAttempts > 0 || isAdmin ? '#000' : '#999',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {isAdmin ? "∞" : `${tournamentAttempts}/3`}
              </span>
            </div>
            <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>
              1 USDC entry • Top 5 win • 3 attempts per entry
            </p>
          </div>

          {/* Leaderboard */}
          <div
            onClick={onLeaderboard}
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid #444',
              borderRadius: '16px',
              padding: '18px',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px #44444444';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>
                📊 Leaderboard
              </span>
            </div>
            <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>
              This week&apos;s rankings • Live updates
            </p>
          </div>

          {/* Prize Pool */}
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(234,179,8,0.8)',
              borderRadius: '16px',
              padding: '18px',
              textAlign: 'left',
            }}
          >
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#eab308' }}>
                💰 Prize Pool
              </span>
              <span
                style={{
                  background: '#fff',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                Weekly
              </span>
            </div>

            <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: 6 }}>
              ${prizePool} USDC
            </div>

            <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>
              Weekly distribution • Top 5 winners
            </p>
          </div>

          {/* Recommended Apps */}
          {recommendedApps.length > 0 && (
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(124,58,237,0.7)',
                borderRadius: '16px',
                padding: '18px',
              }}
            >
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#7c3aed' }}>
                  ✨ Recommended Apps
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recommendedApps.map((app, i) => (
                  
                    key={i}
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: 'none',
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(124,58,237,0.35)',
                      borderRadius: '12px',
                      padding: '12px',
                      color: '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{app.name}</div>
                    <div style={{ color: '#aaa', fontSize: '0.75rem', marginTop: 4 }}>
                      {app.description}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer space */}
          <div style={{ height: 18 }} />
        </div>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
    </div>
  );
}
