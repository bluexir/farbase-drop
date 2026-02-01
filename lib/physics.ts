import Matter from "matter-js";
import { getCoinByLevel } from "./coins";

const { Engine, World, Bodies } = Matter;

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
    if (isGameOver) return;

    // Game over kontrolü burada: yeni coin düşürmek İSTEDİĞİMIZDA
    // mevcut coinleri kontrol et. Yeni coin henüz dünyada yok.
    for (const coin of coins) {
      const coinData = getCoinByLevel(coin.level);
      if (!coinData) continue;
      if (coin.body.position.y - coinData.radius < DANGER_LINE) {
        isGameOver = true;
        return;
      }
    }

    const nextLevel = 1;
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

  function checkMerges() {
    if (isMerging) return;
    isMerging = true;

    for (let i = 0; i < coins.length; i++) {
      for (let j = i + 1; j < coins.length; j++) {
        if (coins[i].level !== coins[j].level) continue;
        if (coins[i].level >= 7) continue;

        const a = coins[i].body;
        const b = coins[j].body;

        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const coinData = getCoinByLevel(coins[i].level);
        if (!coinData) continue;

        if (dist <= coinData.radius * 2 + 2) {
          const newLevel = coins[i].level + 1;
          const newCoinData = getCoinByLevel(newLevel);
          if (!newCoinData) continue;

          const newX = (a.position.x + b.position.x) / 2;
          const newY = (a.position.y + b.position.y) / 2;

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
          checkMerges();
          return;
        }
      }
    }

    isMerging = false;
  }

  function update() {
    Engine.update(engine, 1000 / 60);
    checkMerges();
    // checkGameOver burada yok artık, addCoin'de yapılıyor
  }

  function destroy() {
    Engine.clear(engine);
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
