import { Redis } from "@upstash/redis";

export type LeaderboardEntry = {
  fid: number;
  address: string;
  score: number;
  mergeCount: number;
  highestLevel: number;
  playedAt: number;
};

export type EnrichedEntry = LeaderboardEntry & {
  displayName?: string;
  username?: string;
  pfpUrl?: string;
};

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function getKey(mode: "practice" | "tournament") {
  return `leaderboard:${mode}:${getWeekKey()}`;
}

function getBestKey(mode: "practice" | "tournament", fid: number) {
  return `leaderboard:${mode}:${getWeekKey()}:best:${fid}`;
}

function getWeekKey() {
  const now = new Date();
  const utc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  const day = utc.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);

  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function saveScore(
  mode: "practice" | "tournament",
  entry: LeaderboardEntry
) {
  const bestKey = getBestKey(mode, entry.fid);
  const prev = await redis.get<LeaderboardEntry>(bestKey);

  // keep higher score only
  if (prev && prev.score >= entry.score) {
    return;
  }

  await redis.set(bestKey, entry);

  const key = getKey(mode);
  // store as hash map by fid
  await redis.hset(key, {
    [String(entry.fid)]: JSON.stringify(entry),
  });
}

export async function getTop5(mode: "practice" | "tournament") {
  const key = getKey(mode);
  const all = await redis.hgetall<Record<string, string>>(key);

  const entries: LeaderboardEntry[] = Object.values(all || {})
    .map((v) => {
      try {
        if (typeof v === "object" && v !== null) return v as unknown as LeaderboardEntry;
        if (typeof v === "string") return JSON.parse(v) as LeaderboardEntry;
        return null;
      } catch (_e) {
        return null;
      }
    })
    .filter(Boolean) as LeaderboardEntry[];

  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, 5);
}

export async function getTop5Tournament() {
  return getTop5("tournament");
}

export async function getPlayerBestScore(
  mode: "practice" | "tournament",
  fid: number
) {
  const bestKey = getBestKey(mode, fid);
  const best = await redis.get<LeaderboardEntry>(bestKey);
  return best || null;
}

async function fetchProfiles(fids: number[]) {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey || fids.length === 0) return {};

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids.join(",")}`,
      {
        headers: {
          accept: "application/json",
          api_key: apiKey,
        } as any,
      }
    );

    if (!res.ok) return {};
    const data = await res.json();

    const users = data?.users || [];
    const map: Record<number, any> = {};
    for (const u of users) {
      map[u.fid] = u;
    }
    return map;
  } catch (_e) {
    return {};
  }
}

export async function enrichWithProfiles(entries: LeaderboardEntry[]) {
  const fids = entries.map((e) => e.fid);
  const profiles = await fetchProfiles(fids);

  return entries.map((e) => {
    const p = profiles[e.fid];
    const enriched: EnrichedEntry = {
      ...e,
      displayName: p?.display_name,
      username: p?.username,
      pfpUrl: p?.pfp_url,
    };
    return enriched;
  });
}
