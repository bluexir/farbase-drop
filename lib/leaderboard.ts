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

// ---------- Week Key (UTC Monday 00:00) ----------
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

// ---------- Key Strategy ----------
// Tournament: weekly
// Practice: all-time (never resets) + legacy weekly (for recovery/migration)

function practiceAllKey() {
  return `leaderboard:practice:all`;
}

function practiceLegacyWeekKey() {
  // This is where your existing scores were stored before the change
  return `leaderboard:practice:${getWeekKey()}`;
}

function tournamentWeekKey() {
  return `leaderboard:tournament:${getWeekKey()}`;
}

function getKey(mode: "practice" | "tournament") {
  if (mode === "practice") return practiceAllKey();
  return tournamentWeekKey();
}

function getBestKey(mode: "practice" | "tournament", fid: number) {
  if (mode === "practice") return `leaderboard:practice:best:${fid}`;
  return `leaderboard:tournament:${getWeekKey()}:best:${fid}`;
}

// Legacy best (older version wrote weekly best)
function getLegacyBestKeyForPractice(fid: number) {
  return `leaderboard:practice:${getWeekKey()}:best:${fid}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLeaderboardEntry(v: unknown): v is LeaderboardEntry {
  if (!isPlainObject(v)) return false;
  return (
    typeof (v as any).fid === "number" &&
    typeof (v as any).address === "string" &&
    typeof (v as any).score === "number" &&
    typeof (v as any).mergeCount === "number" &&
    typeof (v as any).highestLevel === "number" &&
    typeof (v as any).playedAt === "number"
  );
}

// ✅ robust parser: handles Redis returning object OR JSON string
function parseEntry(v: unknown): LeaderboardEntry | null {
  try {
    if (!v) return null;
    if (typeof v === "string") {
      const parsed = JSON.parse(v);
      return isLeaderboardEntry(parsed) ? parsed : null;
    }
    return isLeaderboardEntry(v) ? (v as LeaderboardEntry) : null;
  } catch {
    return null;
  }
}

function parseAllEntries(all: Record<string, string> | null | undefined) {
  const entries: LeaderboardEntry[] = Object.values(all || {})
    .map((v) => {
      try {
        const parsed = typeof v === "string" ? JSON.parse(v) : v;
        return isLeaderboardEntry(parsed) ? parsed : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as LeaderboardEntry[];

  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function mergeBestByFid(a: LeaderboardEntry[], b: LeaderboardEntry[]) {
  const map = new Map<number, LeaderboardEntry>();
  for (const e of a) map.set(e.fid, e);
  for (const e of b) {
    const prev = map.get(e.fid);
    if (!prev || e.score > prev.score) map.set(e.fid, e);
  }
  const out = Array.from(map.values());
  out.sort((x, y) => y.score - x.score);
  return out;
}

async function getHashEntryScore(key: string, fid: number): Promise<number | null> {
  try {
    const raw = await redis.hget<string>(key, String(fid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isLeaderboardEntry(parsed) ? parsed.score : null;
  } catch {
    return null;
  }
}

// ---------- SAVE ----------
// ✅ Guarantee: leaderboard never goes DOWN and WILL update when score increases.
// We determine previous score from BOTH bestKey and current leaderboard hash to avoid mismatch bugs.
export async function saveScore(
  mode: "practice" | "tournament",
  entry: LeaderboardEntry
) {
  const fidStr = String(entry.fid);

  const bestKey = getBestKey(mode, entry.fid);
  const prevBestRaw = await redis.get<unknown>(bestKey);
  const prevBestEntry = parseEntry(prevBestRaw);
  const prevBestScoreFromKey = prevBestEntry?.score ?? 0;

  const key = getKey(mode);
  const prevBestScoreFromHash = (await getHashEntryScore(key, entry.fid)) ?? 0;

  // Source of truth: whichever is higher (fixes bestKey/hash mismatch)
  const prevScore = Math.max(prevBestScoreFromKey, prevBestScoreFromHash);

  const isNewBest = entry.score > prevScore;

  // If NOT new best, do NOT overwrite anything
  if (!isNewBest) {
    return;
  }

  // Update best key
  await redis.set(bestKey, entry);

  // Update main leaderboard hash (by fid) ONLY when new best
  await redis.hset(key, { [fidStr]: JSON.stringify(entry) });

  // Practice legacy write (optional but safe for transition) — only when it improves
  if (mode === "practice") {
    const legacyKey = practiceLegacyWeekKey();

    const legacyPrevScore = (await getHashEntryScore(legacyKey, entry.fid)) ?? 0;
    if (entry.score > legacyPrevScore) {
      await redis.hset(legacyKey, { [fidStr]: JSON.stringify(entry) });
    }

    const legacyBest = getLegacyBestKeyForPractice(entry.fid);
    const prevLegacyRaw = await redis.get<unknown>(legacyBest);
    const prevLegacyEntry = parseEntry(prevLegacyRaw);
    const prevLegacyScore = prevLegacyEntry?.score ?? 0;

    if (entry.score > prevLegacyScore) {
      await redis.set(legacyBest, entry);
    }
  }
}

// ---------- READ ----------
export async function getLeaderboard(
  mode: "practice" | "tournament",
  limit = 500
) {
  const safeLimit = Math.max(1, Math.min(1000, limit));

  // Tournament: unchanged
  if (mode === "tournament") {
    const all = await redis.hgetall<Record<string, string>>(getKey(mode));
    const entries = parseAllEntries(all);
    return entries.slice(0, safeLimit);
  }

  // Practice: read ALL-TIME + legacy-week, then merge best by fid
  const allKey = practiceAllKey();
  const legacyKey = practiceLegacyWeekKey();

  const allHash = await redis.hgetall<Record<string, string>>(allKey);
  const allEntries = parseAllEntries(allHash);

  const legacyHash = await redis.hgetall<Record<string, string>>(legacyKey);
  const legacyEntries = parseAllEntries(legacyHash);

  // If all-time is empty but legacy has data: MIGRATE ONCE (safe)
  if (allEntries.length === 0 && legacyEntries.length > 0) {
    const payload: Record<string, string> = {};
    for (const e of legacyEntries) payload[String(e.fid)] = JSON.stringify(e);
    await redis.hset(allKey, payload);

    // Also migrate best keys to all-time best keys
    for (const e of legacyEntries) {
      const bestKey = getBestKey("practice", e.fid);
      const prev = await redis.get<unknown>(bestKey);
      const prevEntry = parseEntry(prev);
      const prevScore = prevEntry?.score ?? 0;
      if (e.score > prevScore) {
        await redis.set(bestKey, e);
      }
    }

    const merged = mergeBestByFid(legacyEntries, []);
    return merged.slice(0, safeLimit);
  }

  const merged = mergeBestByFid(allEntries, legacyEntries);
  return merged.slice(0, safeLimit);
}

// payout tarafı için top5 aynı kalsın
export async function getTop5(mode: "practice" | "tournament") {
  return getLeaderboard(mode, 5);
}

export async function getTop5Tournament() {
  return getTop5("tournament");
}

export async function getPlayerBestScore(
  mode: "practice" | "tournament",
  fid: number
) {
  const bestKey = getBestKey(mode, fid);
  const bestRaw = await redis.get<unknown>(bestKey);
  const best = parseEntry(bestRaw);
  if (best) return best;

  // Fallback to hash if bestKey missing/format mismatch
  const fromHash = await redis.hget<string>(getKey(mode), String(fid));
  if (fromHash) {
    const parsed = parseEntry(fromHash);
    if (parsed) {
      await redis.set(bestKey, parsed);
      return parsed;
    }
  }

  // Practice legacy fallback (only if needed)
  if (mode === "practice") {
    const legacyBestKey = getLegacyBestKeyForPractice(fid);
    const legacyRaw = await redis.get<unknown>(legacyBestKey);
    const legacy = parseEntry(legacyRaw);
    if (legacy) {
      await redis.set(bestKey, legacy);
      return legacy;
    }
  }

  return null;
}

// ---------- NEYNAR ENRICH ----------
async function fetchProfilesBatch(fids: number[]) {
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
    for (const u of users) map[u.fid] = u;
    return map;
  } catch {
    return {};
  }
}

async function fetchProfiles(fids: number[]) {
  const map: Record<number, any> = {};
  const chunkSize = 100;

  for (let i = 0; i < fids.length; i += chunkSize) {
    const chunk = fids.slice(i, i + chunkSize);
    const part = await fetchProfilesBatch(chunk);
    Object.assign(map, part);
  }

  return map;
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
