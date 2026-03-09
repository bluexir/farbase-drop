import type { Redis } from "@upstash/redis";

// Practice artık sınırsız - limit yok
// Tournament değişmedi: her 1 USDC = 3 hak
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

function tournamentPurchasedKey(fid: number) {
  const week = getWeekKey();
  return `attempts:tournament:${week}:${fid}:purchased`;
}

function tournamentUsedKey(fid: number) {
  const week = getWeekKey();
  return `attempts:tournament:${week}:${fid}:used`;
}

// ---- Practice (SINIRSIZ) ----

export async function getPracticeRemaining(
  _redis: Redis,
  _fid: number,
  _admin: boolean
): Promise<number> {
  // Practice artık sınırsız - her zaman yüksek bir değer döndür
  // UI'da "∞" veya "Unlimited" olarak gösterilecek
  return Infinity;
}

export async function consumePracticeAttempt(
  _redis: Redis,
  _fid: number,
  _admin: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Practice sınırsız - her zaman izin ver
  return { ok: true };
}

export function getPracticeResetInSeconds(): number | null {
  // Practice sınırsız - reset yok
  return null;
}

// ---- Tournament (her 1 USDC = 3 hak, sınırsız satın alma) ----

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

// ---- Generic wrappers (save-score route için) ----

export async function getRemainingAttempts(
  redis: Redis,
  mode: "practice" | "tournament",
  fid: number,
  admin: boolean
): Promise<number> {
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
): Promise<number | null> {
  if (mode === "practice") {
    return getPracticeResetInSeconds();
  }
  return null;
}
