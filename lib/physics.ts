import Matter from "matter-js";
import { getCoinByLevel, CoinType } from "./coins";

const { Engine, World, Bodies, Body, Events } = Matter;

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 600;
export const DANGER_LINE = 30;
const WALL_THICKNESS = 20;

export interface GameCoin {
  body: Matter.Body;
  level: number;
}

export interface PhysicsEngine {
  engine: Matter.Engine;
  coins: GameCoin[];
  mergeCount: number;
  highestLevel: number;
  isGameOver: boolean;
  addCoin: (x: number) => void;
  update: () => void;
  destroy: () => void;
}

export function createPhysicsEngine(
  onMerge: (fromLevel: number, toLevel: number) => void
): PhysicsEngine {
  const engine = Engine.create({
    gravity: { x: 0, y: 1 },
  });

  const coins: GameCoin[] = [];
  let mergeCount = 0;
  let highestLevel = 1;
  let isGameOver = false;
  let isMerging = false;

  // Duvarlar
  const leftWall = Bodies.rectangle(
    -WALL_THICKNESS / 2,
    GAME_HEIGHT / 2,
    WALL_THICKNESS,
    GAME_HEIGHT * 2,
    { isStatic: true, friction: 0.1 }
  );

  const rightWall = Bodies.rectangle(
    GAME_WIDTH + WALL_THICKNESS / 2,
    GAME_HEIGHT / 2,
    WALL_THICKNESS,
    GAME_HEIGHT * 2,
    { isStatic: true, friction: 0.1 }
  );

  const floor = Bodies.rectangle(
    GAME_WIDTH / 2,
    GAME_HEIGHT + WALL_THICKNESS / 2,
    GAME_WIDTH + WALL_THICKNESS * 2,
    WALL_THICKNESS,
    { isStatic: true, friction: 0.1 }
  );

  World.add(engine.world, [leftWall, rightWall, floor]);

  function addCoin(x: number) {
    const nextLevel = getNextDropLevel();
    const coinData = getCoinByLevel(nextLevel);
    if (!coinData) return;

    const clampedX = Math.max(
      coinData.radius,
      Math.min(GAME_WIDTH - coinData.radius, x)
    );

    const body = Bodies.circle(clampedX, coinData.radius, coinData.radius, {
      restitution: 0.3,
      friction: 0.1,
      density: 0.002,
      label: `coin-${nextLevel}`,
    });

    (body as any).coinLevel = nextLevel;

    World.add(engine.world, body);
    coins.push({ body, level: nextLevel });
  }

  function getNextDropLevel(): number {
    // Şimdilik her zaman level 1 düşürüyor, ileride random yapılabilir
    return 1;
  }

  function checkMerges() {
    if (isMerging) return;
    isMerging = true;

    for (let i = 0; i < coins.length; i++) {
      for (let j = i + 1; j < coins.length; j++) {
        if (coins[i].level !== coins[j].level) continue;
        if (coins[i].level >= 7) continue; // BTC max level

        const a = coins[i].body;
        const b = coins[j].body;

        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const coinData = getCoinByLevel(coins[i].level);
        if (!coinData) continue;

        // İki coin birbirine değdiğinde (radius toplamı kadar yakın)
        if (dist <= coinData.radius * 2 + 2) {
          const newLevel = coins[i].level + 1;
          const newCoinData = getCoinByLevel(newLevel);
          if (!newCoinData) continue;

          // Orta noktada yeni coin
          const newX = (a.position.x + b.position.x) / 2;
          const newY = (a.position.y + b.position.y) / 2;

          // Eskileri kaldır
          World.remove(engine.world, a);
          World.remove(engine.world, b);

          const removeI = coins.findIndex((c) => c.body === a);
          const removeJ = coins.findIndex((c) => c.body === b);
          if (removeJ > removeI) {
            coins.splice(removeJ, 1);
            coins.splice(removeI, 1);
          } else {
            coins.splice(removeI, 1);
            coins.splice(removeJ, 1);
          }

          // Yeni coin ekle
          const newBody = Bodies.circle(newX, newY, newCoinData.radius, {
            restitution: 0.3,
            friction: 0.1,
            density: 0.002,
            label: `coin-${newLevel}`,
          });
          (newBody as any).coinLevel = newLevel;

          World.add(engine.world, newBody);
          coins.push({ body: newBody, level: newLevel });

          mergeCount++;
          if (newLevel > highestLevel) {
            highestLevel = newLevel;
          }

          onMerge(newLevel - 1, newLevel);

          isMerging = false;
          // Chain reaction kontrolü
          checkMerges();
          return;
        }
      }
    }

    isMerging = false;
  }

  function checkGameOver() {
    for (const coin of coins) {
      if (coin.body.position.y - getCoinByLevel(coin.level)!.radius < DANGER_LINE) {
        isGameOver = true;
        return;
      }
    }
  }

  function update() {
    Engine.update(engine, 1000 / 60);
    checkMerges();
    checkGameOver();
  }

  function destroy() {
    Engine.clear(engine, false);
  }

  return {
    engine,
    coins,
    get mergeCount() {
      return mergeCount;
    },
    get highestLevel() {
      return highestLevel;
    },
    get isGameOver() {
      return isGameOver;
    },
    addCoin,
    update,
    destroy,
  };
}
