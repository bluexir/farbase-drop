'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import HowToPlay from './HowToPlay';
import type { Theme } from '@/app/page';
import { Lang, t } from '@/lib/i18n';

interface MainMenuProps {
  fid: number | null;
  theme: Theme;
  platform: "farcaster" | "base";
  lang: Lang;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onPractice: () => void;
  onTournament: () => void;
  onLeaderboard: () => void;
  onChallenge?: () => void;
  challengeCount?: number;
  onAdmin?: () => void;
}

type AttemptsResponse = {
  mode: 'practice' | 'tournament';
  remaining: number | null;
  limit: number | null;
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
  theme,
  platform,
  lang,
  onToggleLang,
  onToggleTheme,
  onPractice,
  onTournament,
  onLeaderboard,
  onChallenge,
  challengeCount,
  onAdmin,
}: MainMenuProps) {
  const [prizePool, setPrizePool] = useState<string>('0');
  const [recommendedApps, setRecommendedApps] = useState<any[]>([]);
  const [tournamentAttempts, setTournamentAttempts] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? 'radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)' : 'radial-gradient(circle at center, #ffffff 0%, #f0f0f0 100%)',
    text: isDark ? '#fff' : '#1a1a1a',
    textMuted: isDark ? '#888' : '#666',
    textDimmed: isDark ? '#666' : '#888',
    cardBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    border: isDark ? '#444' : '#ddd',
  };

  useEffect(() => {
    try {
      const onboarded = localStorage.getItem('farbase_onboarded');
      if (!onboarded) {
        setShowHowToPlay(true);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    async function fetchPrizePool() {
      try {
        const res = await fetch('/api/prize-pool');
        const data = await res.json();
        setPrizePool(data.amount || '0');
      } catch (e) {
        console.error('Failed to fetch prize pool:', e);
      }
    }

    async function fetchRecommendedApps() {
      try {
        const res = await fetch('/recommended-apps.json');
        const data = await res.json();
        const allApps = data.apps || [];
        const filtered = allApps.filter((app: any) => 
          !app.platform || app.platform === platform || app.platform === "both"
        );
        setRecommendedApps(filtered);
      } catch (e) {
        console.error('Failed to fetch recommended apps:', e);
      }
    }

    async function fetchAttempts() {
      if (!fid) {
        setTournamentAttempts(0);
        setIsAdmin(false);
        return;
      }

      try {
        const practiceRes = await fetchWithQuickAuth(fid, '/api/remaining-attempts?mode=practice');
        if (practiceRes.ok) {
          const practiceData = (await practiceRes.json()) as AttemptsResponse;
          setIsAdmin(!!practiceData.isAdmin);
        }

        const tournamentRes = await fetchWithQuickAuth(fid, '/api/remaining-attempts?mode=tournament');
        if (tournamentRes.ok) {
          const tournamentData = (await tournamentRes.json()) as AttemptsResponse;
          setTournamentAttempts(
            typeof tournamentData.remaining === 'number' ? tournamentData.remaining : 0
          );
          setIsAdmin((prev) => prev || !!tournamentData.isAdmin);
        }
      } catch (e) {
        console.error('Failed to fetch attempts:', e);
      }
    }

    fetchPrizePool();
    fetchRecommendedApps();
    fetchAttempts();
  }, [fid, platform]);

  // Practice artık sınırsız - her zaman tıklanabilir
  const practiceClickable = true;

  // Sponsor DM linki - platform bazlı
  const sponsorUsername = platform === 'base' ? '@bluexir.farcaster.eth' : '@bluexir';

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        background: colors.bg,
        padding: '24px',
        paddingBottom: '40px',
        color: colors.text,
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
            <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: '8px' }}>
              <button
                onClick={onToggleLang}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(0,243,255,0.25)',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  color: colors.text,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                title={lang === 'en' ? t(lang, 'menu.switchToTurkish') : t(lang, 'menu.switchToEnglish')}
              >
                {lang === 'en' ? 'TR' : 'EN'}
              </button>

              <button
                onClick={onToggleTheme}
                style={{
                  background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  border: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`,
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  color: colors.text,
                }}
                title={theme === 'dark' ? t(lang, 'menu.switchToLight') : t(lang, 'menu.switchToDark')}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
        </div>

        <p
          style={{
            color: colors.textDimmed,
            fontSize: '0.8rem',
            marginBottom: '6px',
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          {t(lang, 'menu.subtitle')}
        </p>

        <button
          onClick={() => setShowHowToPlay(true)}
          style={{
            background: 'none',
            border: 'none',
            color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: '16px',
            textAlign: 'center',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          {t(lang, 'menu.howToPlay')}
        </button>

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
            {t(lang, 'menu.adminPanel')}
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
          {/* Practice Card - Sınırsız */}
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
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#00f3ff' }}>{t(lang, 'menu.practice')}</span>
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
                {t(lang, 'menu.practiceUnlimitedShort')}
              </span>
            </div>

            <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>
              {t(lang, 'menu.practiceUnlimited')}
            </p>
          </div>

          {/* Tournament Card */}
          <div
            onClick={() => {
              if (!fid) return;
              onTournament();
            }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid #ff00ff',
              borderRadius: '16px',
              padding: '18px',
              cursor: fid ? 'pointer' : 'not-allowed',
              opacity: fid ? 1 : 0.6,
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!fid) return;
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
                {t(lang, 'menu.tournament')}
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
                {isAdmin ? t(lang, 'menu.unlimited') : tournamentAttempts + '/3'}
              </span>
            </div>
            <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>
              {fid
                ? t(lang, 'menu.tournamentTeaser')
                : t(lang, 'menu.signInRequiredTournament')}
            </p>
          </div>

          {/* Challenge Card */}
          {onChallenge && (
            <div
              onClick={() => {
                if (!fid) return;
                onChallenge();
              }}
              style={{
                background: colors.cardBg,
                backdropFilter: 'blur(12px)',
                border: '1px solid #f97316',
                borderRadius: '16px',
                padding: '18px',
                cursor: fid ? 'pointer' : 'not-allowed',
                opacity: fid ? 1 : 0.6,
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!fid) return;
                e.currentTarget.style.boxShadow = '0 0 20px rgba(249,115,22,0.3)';
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
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#f97316' }}>
                  ⚔️ {t(lang, 'menu.challenges')}
                </span>
                {typeof challengeCount === 'number' && challengeCount > 0 && (
                  <span
                    style={{
                      background: '#f97316',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {challengeCount}
                  </span>
                )}
              </div>
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>
                {fid ? t(lang, 'menu.challengesDesc') : t(lang, 'menu.signInRequiredChallenge')}
              </p>
            </div>
          )}

          {/* Leaderboard Card */}
          <div
            onClick={() => {
              if (!fid) return;
              onLeaderboard();
            }}
            style={{
              background: colors.cardBg,
              backdropFilter: 'blur(12px)',
              border: `1px solid ${isDark ? '#444' : '#ddd'}`,
              borderRadius: '16px',
              padding: '18px',
              cursor: fid ? 'pointer' : 'not-allowed',
              opacity: fid ? 1 : 0.6,
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!fid) return;
              e.currentTarget.style.boxShadow = '0 0 20px #44444444';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: colors.text }}>{t(lang, 'menu.leaderboard')}</span>
            </div>
            <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>
              {fid ? t(lang, 'menu.thisWeeksRankings') : t(lang, 'menu.signInRequiredLeaderboard')}
            </p>
          </div>

          {/* Prize Pool Card */}
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
            <div
              style={{
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#eab308' }}>Prize Pool</span>
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

            <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: 6, color: colors.text }}>
              {'$' + prizePool + ' USDC'}
            </div>

            <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0, marginBottom: '8px' }}>
              Weekly distribution - Top 5 winners
            </p>

            {/* Prize Distribution */}
            <p style={{ color: '#eab308', fontSize: '0.7rem', margin: 0, fontWeight: 600 }}>
              {t(lang, 'menu.prizeDistribution')}
            </p>
          </div>

          {/* Sponsor Banner */}
          <div
            style={{
              background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(59,130,246,0.5)',
              borderRadius: '16px',
              padding: '16px 18px',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#3b82f6' }}>
                💼 {t(lang, 'menu.sponsorTitle')}
              </span>
            </div>
            <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>
              {t(lang, 'menu.sponsorCta')} <span style={{ color: '#3b82f6', fontWeight: 700 }}>{sponsorUsername}</span>
            </p>
          </div>

          {/* Recommended Apps */}
          {recommendedApps.length > 0 && (
            <div
              style={{
                background: colors.cardBg,
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(124,58,237,0.7)',
                borderRadius: '16px',
                padding: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <img
                  src="/Recommended.icon.png"
                  alt=""
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#7c3aed' }}>
                  Recommended Apps
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recommendedApps.map((app, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={async () => {
                      try {
                        await sdk.actions.openUrl(app.url);
                      } catch (_e) {
                        window.open(app.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.05)',
                      border: '1px solid rgba(124,58,237,0.35)',
                      borderRadius: '12px',
                      padding: '12px',
                      color: colors.text,
                      transition: 'border-color 0.2s ease',
                      width: '100%',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {app.icon && (
                      <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>
                        {app.icon}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{app.name}</div>
                      <div
                        style={{
                          color: colors.textMuted,
                          fontSize: '0.72rem',
                          marginTop: 3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {app.description}
                      </div>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        background: 'rgba(124,58,237,0.3)',
                        border: '1px solid rgba(124,58,237,0.5)',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: '#c4b5fd',
                      }}
                    >
                      Open
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 18 }} />
        </div>
      </div>
      {showHowToPlay && (
        <HowToPlay
          theme={theme}
          lang={lang}
          onClose={() => {
            setShowHowToPlay(false);
            try {
              localStorage.setItem('farbase_onboarded', 'true');
            } catch (e) {}
          }}
        />
      )}
    </div>
  );
}
