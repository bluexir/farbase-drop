import { Redis } from "@upstash/redis";

export interface LeaderboardEntry {
  fid: number;
  address: string;
  score: number;
  mergeCount: number;
  highestLevel: number;
  playedAt: number;
}

export interface EnrichedLeaderboardEntry extends LeaderboardEntry {
  displayName?: string;
  username?: string;
  pfpUrl?: string;
}

const REFERENCE_WEEK_START = new Date("2025-02-04T14:00:00Z").getTime();

export function getWeekNumber(): number {
  const now = Date.now();
  const diffMs = now - REFERENCE_WEEK_START;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function saveScore(
  mode: "practice" | "tournament",
  entry: LeaderboardEntry
): Promise<void> {
  const weekNumber = getWeekNumber();
  const key = `${mode}:week:${weekNumber}:${entry.fid}`;

  const existing = await redis.get<LeaderboardEntry>(key);
  if (existing && existing.score >= entry.score) {
    return; // keep higher score
  }

  await redis.set(key, entry);
}

export async function getTop5(
  mode: "practice" | "tournament"
): Promise<LeaderboardEntry[]> {
  const weekNumber = getWeekNumber();
  const pattern = `${mode}:week:${weekNumber}:*`;

  const rawKeys = await redis.keys(pattern);
  const keys: string[] = Array.isArray(rawKeys)
    ? rawKeys.filter((k): k is string => typeof k === "string")
    : [];

  if (keys.length === 0) return [];

  const entries: LeaderboardEntry[] = [];
  for (const key of keys) {
    const entry = await redis.get<LeaderboardEntry>(key);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, 5);
}

export async function getTop5Tournament(): Promise<LeaderboardEntry[]> {
  return getTop5("tournament");
}

export async function getPlayerBestScore(
  mode: "practice" | "tournament",
  fid: number
): Promise<LeaderboardEntry | null> {
  const weekNumber = getWeekNumber();
  const key = `${mode}:week:${weekNumber}:${fid}`;

  const entry = await redis.get<LeaderboardEntry>(key);
  return entry || null;
}

// ── Neynar Enrichment ─────────────────────────────────

export async function enrichWithProfiles(
  entries: LeaderboardEntry[]
): Promise<EnrichedLeaderboardEntry[]> {
  if (entries.length === 0) return [];

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    // No API key — return entries with FID-only display
    return entries.map((e) => ({
      ...e,
      displayName: `FID: ${e.fid}`,
      username: undefined,
      pfpUrl: undefined,
    }));
  }

  try {
    const fids = entries.map((e) => e.fid).join(",");
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids}`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": apiKey,
        },
        next: { revalidate: 60 }, // cache 60s
      }
    );

    if (!res.ok) {
      console.error("Neynar API error:", res.status);
      return entries.map((e) => ({
        ...e,
        displayName: `FID: ${e.fid}`,
      }));
    }

    const data = await res.json();
    const users: Record<
      number,
      { display_name: string; username: string; pfp_url: string }
    > = {};

    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) {
        users[u.fid] = {
          display_name: u.display_name || `FID: ${u.fid}`,
          username: u.username || "",
          pfp_url: u.pfp_url || "",
        };
      }
    }

    return entries.map((e) => {
      const profile = users[e.fid];
      return {
        ...e,
        displayName: profile?.display_name || `FID: ${e.fid}`,
        username: profile?.username,
        pfpUrl: profile?.pfp_url,
      };
    });
  } catch (err) {
    console.error("Neynar enrichment failed:", err);
    return entries.map((e) => ({
      ...e,
      displayName: `FID: ${e.fid}`,
    }));
  }
}
