import Matter from "matter-js";
import { getCoinByLevel } from "@/lib/coins";

export const GAME_WIDTH = 420;
export const GAME_HEIGHT = 560;
export const DANGER_LINE = 120;

export type CoinBody = {
  id: string;
  level: number;
  x: number;
  y: number;
  radius: number;
};

export type PhysicsEngine = {
  dropCoin: (x: number) => void;
  getBodies: () => CoinBody[];
  destroy: () => void;
};

const RADIUS_BY_LEVEL: Record<number, number> = {
  1: 16,
  2: 18,
  3: 20,
  4: 22,
  5: 24,
  6: 26,
  7: 28,
  8: 30,
  9: 32,
};

function radiusForLevel(level: number) {
  return RADIUS_BY_LEVEL[level] || Math.min(44, 16 + level * 2);
}

export function createPhysicsEngine(params: {
  width: number;
  height: number;
  dangerLine: number;
  onMerge: (fromLevel: number, toLevel: number, scoreInc: number) => void;
  onGameOver: () => void;
}): PhysicsEngine {
  const engine = Matter.Engine.create();
  engine.gravity.y = 1.05;

  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);

  // Walls
  const walls = [
    Matter.Bodies.rectangle(params.width / 2, params.height + 30, params.width, 60, {
      isStatic: true,
      label: "floor",
    }),
    Matter.Bodies.rectangle(-30, params.height / 2, 60, params.height, {
      isStatic: true,
      label: "wall-left",
    }),
    Matter.Bodies.rectangle(params.width + 30, params.height / 2, 60, params.height, {
      isStatic: true,
      label: "wall-right",
    }),
  ];
  Matter.Composite.add(engine.world, walls);

  let nextId = 1;

  const bodies: { body: Matter.Body; level: number; createdAt: number }[] = [];

  function spawn(level: number, x: number) {
    const r = radiusForLevel(level);
    const b = Matter.Bodies.circle(
      Math.max(r + 6, Math.min(params.width - r - 6, x)),
      40,
      r,
      {
        restitution: 0.15,
        friction: 0.02,
        density: 0.0025,
        label: `coin:${level}`,
      }
    ) as Matter.Body & { _id?: string; _level?: number };
    b._id = `c${nextId++}`;
    b._level = level;

    Matter.Composite.add(engine.world, b);
    bodies.push({ body: b, level, createdAt: Date.now() });
    return b;
  }

  // Start with level-1 preview drop
  spawn(1, params.width / 2);

  // Collision handling: merge same level
  Matter.Events.on(engine, "collisionStart", (evt) => {
    for (const pair of evt.pairs) {
      const a = pair.bodyA as any;
      const b = pair.bodyB as any;

      const aLevel = a?._level;
      const bLevel = b?._level;

      if (!aLevel || !bLevel) continue;
      if (aLevel !== bLevel) continue;

      // prevent merging static walls
      if (String(a.label).startsWith("wall") || String(b.label).startsWith("wall")) continue;
      if (a.label === "floor" || b.label === "floor") continue;

      // Merge
      const fromLevel = aLevel;
      const toLevel = aLevel + 1;

      // remove both bodies from world
      Matter.Composite.remove(engine.world, a);
      Matter.Composite.remove(engine.world, b);

      // remove from tracked bodies
      const idxA = bodies.findIndex((x) => x.body === a);
      if (idxA >= 0) bodies.splice(idxA, 1);
      const idxB = bodies.findIndex((x) => x.body === b);
      if (idxB >= 0) bodies.splice(idxB, 1);

      // spawn merged body at average position
      const mx = (a.position.x + b.position.x) / 2;
      const my = (a.position.y + b.position.y) / 2;

      const merged = spawn(toLevel, mx);
      Matter.Body.setPosition(merged, { x: mx, y: my });

      const coin = getCoinByLevel(toLevel);
      const scoreInc = coin?.score || Math.max(1, toLevel * 2);

      params.onMerge(fromLevel, toLevel, scoreInc);

      break; // avoid double-processing in same tick
    }
  });

  // Game over check
  Matter.Events.on(engine, "afterUpdate", () => {
    for (const item of bodies) {
      const y = item.body.position.y;
      const vy = item.body.velocity.y;

      // only if coin is above danger line and nearly stopped (stack)
      if (y < params.dangerLine && Math.abs(vy) < 0.35) {
        params.onGameOver();
        break;
      }
    }
  });

  return {
    dropCoin(x: number) {
      spawn(1, x);
    },
    getBodies() {
      return bodies.map((b) => {
        const r = radiusForLevel(b.level);
        return {
          id: (b.body as any)._id || "",
          level: b.level,
          x: b.body.position.x,
          y: b.body.position.y,
          radius: r,
        };
      });
    },
    destroy() {
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      Matter.Composite.clear(engine.world, false);
    },
  };
}
