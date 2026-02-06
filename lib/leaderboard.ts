export interface LeaderboardEntry {
  fid: number;
  address: string;
  score: number;
  mergeCount: number;
  highestLevel: number;
  playedAt: number;
}

const REFERENCE_WEEK_START = new Date("2025-02-04T14:00:00Z").getTime();

export function getWeekNumber(): number {
  const now = Date.now();
  const diffMs = now - REFERENCE_WEEK_START;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

import { Redis } from "@upstash/redis";

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
    return;
  }

  await redis.set(key, entry);
}

export async function getTop5(
  mode: "practice" | "tournament"
): Promise<LeaderboardEntry[]> {
  const weekNumber = getWeekNumber();
  const pattern = `${mode}:week:${weekNumber}:*`;

  const keys = await redis.keys(pattern);
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
