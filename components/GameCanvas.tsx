"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createPhysicsEngine,
  GAME_WIDTH,
  GAME_HEIGHT,
  DANGER_LINE,
  PhysicsEngine,
} from "@/lib/physics";
import { getCoinByLevel } from "@/lib/coins";
import { GameEvent, GameLog } from "@/lib/game-log";

interface GameCanvasProps {
  onMerge: (fromLevel: number, toLevel: number, scoreIncrement: number) => void;
  onGameOver: (
    finalScore: number,
    finalMerges: number,
    finalHighest: number,
    gameLog: GameLog
  ) => void;
  mode: "practice" | "tournament";
  gameStarted: boolean;
  fid: number;
  sessionId: string;
}

export default function GameCanvas({
  onMerge,
  onGameOver,
  mode,
  gameStarted,
  fid,
  sessionId,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PhysicsEngine | null>(null);

  // Game stats refs
  const scoreRef = useRef(0);
  const mergesRef = useRef(0);
  const highestRef = useRef(1);
  const overRef = useRef(false);

  // Game log (anti-cheat + analytics)
  const logRef = useRef<GameLog>({
    fid,
    sessionId,
    mode,
    startedAt: Date.now(),
    endedAt: null,
    events: [],
  });

  const pushEvent = useCallback((e: GameEvent) => {
    logRef.current.events.push(e);
  }, []);

  const handleMergeInternal = useCallback(
    (fromLevel: number, toLevel: number, scoreIncrement: number) => {
      scoreRef.current += scoreIncrement;
      mergesRef.current += 1;
      highestRef.current = Math.max(highestRef.current, toLevel);

      pushEvent({
        t: Date.now(),
        type: "merge",
        fromLevel,
        toLevel,
        scoreInc: scoreIncrement,
        score: scoreRef.current,
        merges: mergesRef.current,
        highest: highestRef.current,
      });

      onMerge(fromLevel, toLevel, scoreIncrement);
    },
    [onMerge, pushEvent]
  );

  const handleGameOverInternal = useCallback(() => {
    if (overRef.current) return;
    overRef.current = true;

    logRef.current.endedAt = Date.now();
    pushEvent({
      t: Date.now(),
      type: "game_over",
      score: scoreRef.current,
      merges: mergesRef.current,
      highest: highestRef.current,
    });

    onGameOver(
      scoreRef.current,
      mergesRef.current,
      highestRef.current,
      logRef.current
    );
  }, [onGameOver, pushEvent]);

  // Reset state on mount / key change
  useEffect(() => {
    scoreRef.current = 0;
    mergesRef.current = 0;
    highestRef.current = 1;
    overRef.current = false;

    logRef.current = {
      fid,
      sessionId,
      mode,
      startedAt: Date.now(),
      endedAt: null,
      events: [],
    };

    pushEvent({
      t: Date.now(),
      type: "start",
      mode,
      fid,
      sessionId,
    });
  }, [fid, sessionId, mode, pushEvent]);

  // Initialize physics engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createPhysicsEngine({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      dangerLine: DANGER_LINE,
      onMerge: handleMergeInternal,
      onGameOver: handleGameOverInternal,
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleMergeInternal, handleGameOverInternal]);

  // Input handler: drop a coin at x position
  const dropCoin = useCallback((x: number) => {
    const engine = engineRef.current;
    if (!engine || overRef.current) return;

    engine.dropCoin(x);

    pushEvent({
      t: Date.now(),
      type: "drop",
      x,
      score: scoreRef.current,
      merges: mergesRef.current,
      highest: highestRef.current,
    });
  }, [pushEvent]);

  // Pointer events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (!gameStarted) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      dropCoin(x);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    return () => canvas.removeEventListener("pointerdown", handlePointerDown);
  }, [dropCoin, gameStarted]);

  // Render loop
  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const engine = engineRef.current;
      if (!engine) return;

      // Clear
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      bg.addColorStop(0, "#050510");
      bg.addColorStop(1, "#000000");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw danger line
      ctx.strokeStyle = "rgba(255,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, DANGER_LINE);
      ctx.lineTo(GAME_WIDTH, DANGER_LINE);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw bodies (coins)
      const bodies = engine.getBodies();
      for (const b of bodies) {
        const coin = getCoinByLevel(b.level);
        const color = coin?.color || "#C3A634";
        const r = b.radius;

        // Shadow
        ctx.beginPath();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.arc(b.x + 2, b.y + 3, r, 0, Math.PI * 2);
        ctx.fill();

        // Coin
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.stroke();

        // Symbol
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.font = `bold ${Math.max(10, r * 0.7)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(coin?.symbol || "?", b.x, b.y);
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        paddingTop: 8,
      }}
    >
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.6)",
          touchAction: "none",
          boxShadow: "0 0 30px rgba(0,243,255,0.15)",
        }}
      />
    </div>
  );
}
