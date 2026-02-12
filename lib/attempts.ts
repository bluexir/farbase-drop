import type { Redis } from "@upstash/redis";

export const ATTEMPT_LIMITS: Record<"practice" | "tournament", number> = {
  practice: 3,
  tournament: 3,
};

export function getWeekKey() {
  // UTC week key (Mon-Sun) — deterministic
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

function getAttemptKey(mode: "practice" | "tournament", fid: number) {
  const week = getWeekKey();
  return `attempts:${mode}:${week}:${fid}`;
}

function getResetKey(mode: "practice" | "tournament", fid: number) {
  const week = getWeekKey();
  return `attempts:${mode}:${week}:${fid}:reset`;
}

export async function getResetInSeconds(
  redis: Redis,
  mode: "practice" | "tournament",
  fid: number
) {
  try {
    const resetAt = await redis.get<number>(getResetKey(mode, fid));
    if (!resetAt) return null;
    const now = Date.now();
    const diff = Math.floor((resetAt - now) / 1000);
    return diff > 0 ? diff : 0;
  } catch {
    return null;
  }
}

export async function getRemainingAttempts(
  redis: Redis,
  mode: "practice" | "tournament",
  fid: number,
  admin: boolean
) {
  if (admin) return 999999;

  const key = getAttemptKey(mode, fid);
  const used = (await redis.get<number>(key)) || 0;
  const remaining = ATTEMPT_LIMITS[mode] - used;
  return Math.max(0, remaining);
}

export async function consumeAttempt(
  redis: Redis,
  mode: "practice" | "tournament",
  fid: number,
  admin: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (admin) return { ok: true };

  const key = getAttemptKey(mode, fid);
  const used = (await redis.get<number>(key)) || 0;

  if (used >= ATTEMPT_LIMITS[mode]) {
    return { ok: false, error: "No attempts left" };
  }

  await redis.set(key, used + 1);

  // store/reset timer key once
  const resetKey = getResetKey(mode, fid);
  const exists = await redis.get<number>(resetKey);
  if (!exists) {
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
    // next week monday 00:00 UTC
    const day = utc.getUTCDay();
    const diffToNextMonday = ((8 - day) % 7) || 7;
    utc.setUTCDate(utc.getUTCDate() + diffToNextMonday);
    await redis.set(resetKey, utc.getTime());
  }

  return { ok: true };
}

export async function createTournamentEntry(
  redis: Redis,
  fid: number,
  admin: boolean
) {
  // entries create attempts; for admin keep unlimited
  if (admin) return;

  const key = getAttemptKey("tournament", fid);
  const used = (await redis.get<number>(key)) || 0;

  // entry grants 3 attempts; set used back by 3 (floor at 0)
  const nextUsed = Math.max(0, used - ATTEMPT_LIMITS.tournament);
  await redis.set(key, nextUsed);

  const resetKey = getResetKey("tournament", fid);
  const exists = await redis.get<number>(resetKey);
  if (!exists) {
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
    const diffToNextMonday = ((8 - day) % 7) || 7;
    utc.setUTCDate(utc.getUTCDate() + diffToNextMonday);
    await redis.set(resetKey, utc.getTime());
  }
}

export async function createPracticeEntry(
  redis: Redis,
  fid: number,
  admin: boolean
) {
  if (admin) return;

  const key = getAttemptKey("practice", fid);
  const used = (await redis.get<number>(key)) || 0;

  // practice is free; do nothing here (attempts consumed by save-score)
  await redis.set(key, used);

  const resetKey = getResetKey("practice", fid);
  const exists = await redis.get<number>(resetKey);
  if (!exists) {
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
    const diffToNextMonday = ((8 - day) % 7) || 7;
    utc.setUTCDate(utc.getUTCDate() + diffToNextMonday);
    await redis.set(resetKey, utc.getTime());
  }
}
