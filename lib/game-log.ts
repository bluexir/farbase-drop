import { getCoinByLevel } from "./coins";

export interface GameEvent {
  type: "DROP" | "MERGE";
  timestamp: number;
  data: {
    x?: number;
    level?: number;
    fromLevel?: number;
    toLevel?: number;
  };
}

export interface GameLog {
  sessionId: string;
  fid: number;
  mode: "practice" | "tournament";
  startTime: number;
  endTime?: number;
  events: GameEvent[];
  mergeCount?: number;
  highestLevel?: number;
  finalScore?: number;
}

export interface CalculatedScore {
  score: number;
  mergeCount: number;
  highestLevel: number;
}

/**
 * Server-side skor doğrulama: Game log'daki MERGE event'lerini oynatarak
 * kümülatif skoru hesaplar.
 *
 * Kümülatif formül: Her merge → oluşan yeni coin'in scoreValue'su eklenir.
 * Örnek: DOGE+DOGE→SHIB = +2, ETH+ETH→BTC = +64
 * Toplam = tüm merge puanlarının toplamı
 */
export function calculateScoreFromLog(log: GameLog): CalculatedScore {
  let score = 0;
  let mergeCount = 0;
  let highestLevel = 1;

  for (const event of log.events) {
    if (event.type === "MERGE" && event.data.toLevel) {
      mergeCount++;
      const toLevel = event.data.toLevel;

      if (toLevel > highestLevel) {
        highestLevel = toLevel;
      }

      const coinData = getCoinByLevel(toLevel);
      if (coinData) {
        score += coinData.scoreValue;
      }
    }
  }

  return { score, mergeCount, highestLevel };
}

/**
 * Game log yapısal doğrulama.
 * Sahte/bozuk log'ları reddeder.
 */
export function validateGameLog(log: GameLog): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!log) {
    errors.push("Missing game log");
    return { valid: false, errors };
  }

  if (!log.sessionId) errors.push("Missing sessionId");
  if (!log.fid || log.fid <= 0) errors.push("Invalid fid");
  if (!log.mode || (log.mode !== "practice" && log.mode !== "tournament")) {
    errors.push("Invalid mode");
  }
  if (!log.startTime || log.startTime <= 0) errors.push("Invalid startTime");
  if (!Array.isArray(log.events)) errors.push("Missing events array");

  if (log.events && log.events.length > 0) {
    const firstEvent = log.events[0];
    const lastEvent = log.events[log.events.length - 1];

    if (firstEvent.timestamp < log.startTime - 1000) {
      errors.push("First event before start time");
    }

    // Süre kontrolü: 500ms'den kısa oyun şüpheli
    const duration = lastEvent.timestamp - log.startTime;
    if (duration < 500) {
      errors.push("Game duration too short");
    }

    // Merge event'ler mantıklı mı
    for (const event of log.events) {
      if (event.type === "MERGE") {
        if (
          !event.data.fromLevel ||
          !event.data.toLevel ||
          event.data.toLevel !== event.data.fromLevel + 1
        ) {
          errors.push("Invalid merge event");
          break;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
