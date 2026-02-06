/**
 * Oyun olay logları - Skor doğrulama için
 * Client'tan gelen logları sunucuda replay ederek skoru doğrular
 */

export interface GameEvent {
  type: 'DROP' | 'MERGE';
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
  mode: 'practice' | 'tournament';
  startTime: number;
  endTime?: number;
  events: GameEvent[];
  finalScore?: number;
  mergeCount?: number;
  highestLevel?: number;
}

export function calculateScoreFromLog(log: GameLog): {
  score: number;
  mergeCount: number;
  highestLevel: number;
  isValid: boolean;
} {
  let mergeCount = 0;
  let highestLevel = 1;
  
  for (const event of log.events) {
    if (event.type === 'MERGE') {
      mergeCount++;
      if (event.data.toLevel && event.data.toLevel > highestLevel) {
        highestLevel = event.data.toLevel;
      }
    }
  }

  const scoreValue = getScoreValueByLevel(highestLevel);
  const score = scoreValue * mergeCount;

  const isValid = 
    log.finalScore === score &&
    log.mergeCount === mergeCount &&
    log.highestLevel === highestLevel;

  return { score, mergeCount, highestLevel, isValid };
}

function getScoreValueByLevel(level: number): number {
  const values: Record<number, number> = {
    1: 1,
    2: 2,
    3: 4,
    4: 8,
    5: 16,
    6: 32,
    7: 64,
    8: 128,
  };
  return values[level] || 1;
}

export function validateGame
