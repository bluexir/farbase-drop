import type { Redis } from "@upstash/redis";

export const PRACTICE_LIMIT = 3;
export const PRACTICE_LIMIT_ADMIN = 50;
export const TOURNAMENT_ATTEMPTS_PER_ENTRY = 3;

// ---- Key helpers ----

export function getWeekKey() {
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
  const day = utc.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Monday=0
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);

  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function practiceKey(fid: number) {
  return `attempts:practice:${getDayKey()}:${fid}`;
}

function tournamentPurchasedKey(fid: number) {
  const week = getWeekKey();
  return `attempts:tournament:${week}:${fid}:purchased`;
}

function tournamentUsedKey(fid: number) {
  const week = getWeekKey();
  return `attempts:tournament:${week}:${fid}:used`;
}

// ---- Practice (daily, 3 hak, admin 10) ----

export async function getPracticeRemaining(
  redis: Redis,
  fid: number,
  admin: boolean
) {
  const limit = admin ? PRACTICE_LIMIT_ADMIN : PRACTICE_LIMIT;
  const key = practiceKey(fid);
  const used = (await redis.get<number>(key)) || 0;
  return Math.max(0, limit - used);
}

export async function consumePracticeAttempt(
  redis: Redis,
  fid: number,
  admin: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limit = admin ? PRACTICE_LIMIT_ADMIN : PRACTICE_LIMIT;
  const key = practiceKey(fid);
  const used = (await redis.get<number>(key)) || 0;

  if (used >= limit) {
    return { ok: false, error: "No practice attempts left. Resets at UTC midnight." };
  }

  await redis.set(key, used + 1);
  return { ok: true };
}

export function getPracticeResetInSeconds(): number {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
  return Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
}

// ---- Tournament (her 1 USDC = 3 hak, sinirsiz satin alma) ----

export async function getTournamentRemaining(
  redis: Redis,
  fid: number
) {
  const pKey = tournamentPurchasedKey(fid);
  const uKey = tournamentUsedKey(fid);
  const purchased = (await redis.get<number>(pKey)) || 0;
  const used = (await redis.get<number>(uKey)) || 0;
  return Math.max(0, purchased - used);
}

export async function consumeTournamentAttempt(
  redis: Redis,
  fid: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const remaining = await getTournamentRemaining(redis, fid);

  if (remaining <= 0) {
    return { ok: false, error: "No tournament attempts left. Purchase an entry for 1 USDC." };
  }

  const uKey = tournamentUsedKey(fid);
  const used = (await redis.get<number>(uKey)) || 0;
  await redis.set(uKey, used + 1);
  return { ok: true };
}

export async function createTournamentEntry(
  redis: Redis,
  fid: number
) {
  const pKey = tournamentPurchasedKey(fid);
  const purchased = (await redis.get<number>(pKey)) || 0;
  await redis.set(pKey, purchased + TOURNAMENT_ATTEMPTS_PER_ENTRY);
}

// ---- Generic wrappers (save-score route icin) ----

export async function getRemainingAttempts(
  redis: Redis,
  mode: "practice" | "tournament",
  fid: number,
  admin: boolean
) {
  if (mode === "practice") {
    return getPracticeRemaining(redis, fid, admin);
  }
  return getTournamentRemaining(redis, fid);
}

export async function consumeAttempt(
  redis: Redis,
  mode: "practice" | "tournament",
  fid: number,
  admin: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (mode === "practice") {
    return consumePracticeAttempt(redis, fid, admin);
  }
  return consumeTournamentAttempt(redis, fid);
}

// Legacy compat — getResetInSeconds
export async function getResetInSeconds(
  _redis: Redis,
  mode: "practice" | "tournament",
  _fid: number
) {
  if (mode === "practice") {
    return getPracticeResetInSeconds();
  }
  return null;
}
