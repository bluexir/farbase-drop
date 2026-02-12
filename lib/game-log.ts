export type GameEvent =
  | {
      t: number;
      type: "start";
      mode: "practice" | "tournament";
      fid: number;
      sessionId: string;
    }
  | {
      t: number;
      type: "drop";
      x: number;
      score: number;
      merges: number;
      highest: number;
    }
  | {
      t: number;
      type: "merge";
      fromLevel: number;
      toLevel: number;
      scoreInc: number;
      score: number;
      merges: number;
      highest: number;
    }
  | {
      t: number;
      type: "game_over";
      score: number;
      merges: number;
      highest: number;
    };

export type GameLog = {
  fid: number;
  sessionId: string;
  mode: "practice" | "tournament";
  startedAt: number;
  endedAt: number | null;
  events: GameEvent[];
};

export function validateGameLog(
  log: GameLog,
  expected: {
    fid: number;
    sessionId: string;
    mode: "practice" | "tournament";
    score: number;
    mergeCount: number;
    highestLevel: number;
  }
): { ok: true } | { ok: false; reason: string } {
  if (!log || typeof log !== "object") {
    return { ok: false, reason: "log missing" };
  }
  if (log.fid !== expected.fid) return { ok: false, reason: "fid mismatch" };
  if (log.sessionId !== expected.sessionId)
    return { ok: false, reason: "sessionId mismatch" };
  if (log.mode !== expected.mode) return { ok: false, reason: "mode mismatch" };

  if (!Array.isArray(log.events) || log.events.length < 2) {
    return { ok: false, reason: "events missing" };
  }

  const start = log.events.find((e) => e.type === "start");
  const end = log.events.find((e) => e.type === "game_over");
  if (!start) return { ok: false, reason: "start missing" };
  if (!end) return { ok: false, reason: "game_over missing" };

  // Recompute score/merges/highest from events
  let score = 0;
  let merges = 0;
  let highest = 1;

  for (const e of log.events) {
    if (e.type === "merge") {
      score += e.scoreInc;
      merges += 1;
      highest = Math.max(highest, e.toLevel);
    }
  }

  // Must match reported
  if (score !== expected.score)
    return { ok: false, reason: "score mismatch" };
  if (merges !== expected.mergeCount)
    return { ok: false, reason: "mergeCount mismatch" };
  if (highest !== expected.highestLevel)
    return { ok: false, reason: "highestLevel mismatch" };

  // time sanity
  if (typeof log.startedAt !== "number" || typeof start.t !== "number") {
    return { ok: false, reason: "start time invalid" };
  }
  if (typeof end.t !== "number") {
    return { ok: false, reason: "end time invalid" };
  }
  if (end.t < start.t) return { ok: false, reason: "time reversed" };

  return { ok: true };
}
