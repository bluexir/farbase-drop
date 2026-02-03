"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPhysicsEngine, GAME_WIDTH, GAME_HEIGHT, DANGER_LINE, PhysicsEngine } from "@/lib/physics";
import { getCoinByLevel } from "@/lib/coins";

interface GameCanvasProps {
  onMerge: (fromLevel: number, toLevel: number) => void;
  onGameOver: (mergeCount: number, highestLevel: number) => void;
  gameStarted: boolean;
}

export default function GameCanvas({ onMerge, onGameOver, gameStarted }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PhysicsEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const dropXRef = useRef<number>(GAME_WIDTH / 2);
  const isDraggingRef = useRef<boolean>(false);
  const gameOverCalledRef = useRef<boolean>(false);
  const nextLevelRef = useRef<number>(1); 

  const coinImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const pickNextLevel = useCallback(() => {
    const rand = Math.random();
    if (rand < 0.6) return 1;
    if (rand < 0.9) return 2;
    return 3;
  }, []);

  useEffect(() => {
    const loadImages = async () => {
      const levels = Array.from({ length: 8 }, (_, i) => i + 1);
      const loadPromises = levels.map((level) => {
        const coinData = getCoinByLevel(level);
        if (!coinData || !coinData.iconUrl) return Promise.resolve();

        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            coinImagesRef.current.set(level, img);
            setImagesLoaded(prev => !prev); // Force re-render on each load
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load image: ${coinData.iconUrl}`);
            resolve();
          };
          img.src = coinData.iconUrl;
        });
      });

      await Promise.all(loadPromises);
      setImagesLoaded(true);
    };

    loadImages();
  }, []);

  const drawCoin = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, level: number) => {
    const coinData = getCoinByLevel(level);
    if (!coinData) return;

    const img = coinImagesRef.current.get(level);
    const radius = coinData.radius;

    ctx.save();
    
    // Background and Glow
    ctx.shadowColor = coinData.glowColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = coinData.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Logo check: Draw image if exists and not a sponsor
    if (img && img.complete && !coinData.isSponsor) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    } else {
      // Fallback to text for sponsors or missing images
      ctx.fillStyle = "#fff";
      const fontSize = coinData.isSponsor ? radius * 0.35 : radius * 0.55;
      ctx.font = `bold ${Math.max(8, fontSize)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(coinData.symbol, x, y);
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }, [imagesLoaded]);

  const drawPreview = useCallback((ctx: CanvasRenderingContext2D) => {
    const coinData = getCoinByLevel(nextLevelRef.current);
    if (!coinData) return;

    const x = Math.max(coinData.radius, Math.min(GAME_WIDTH - coinData.radius, dropXRef.current));

    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.5;
    drawCoin(ctx, x, coinData.radius, nextLevelRef.current);
    ctx.globalAlpha = 1;
  }, [drawCoin]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    engine.update();

    if (engine.isGameOver && !gameOverCalledRef.current) {
      gameOverCalledRef.current = true;
      onGameOver(engine.mergeCount, engine.highestLevel);
      return;
    }

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "#0a0a0f"; 
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.beginPath();
    ctx.strokeStyle = "rgba(239,68,68,0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.moveTo(0, DANGER_LINE);
    ctx.lineTo(GAME_WIDTH, DANGER_LINE);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!engine.isGameOver) {
      drawPreview(ctx);
    }

    for (const coin of engine.coins) {
      drawCoin(ctx, coin.body.position.x, coin.body.position.y, coin.level);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [drawCoin, drawPreview, onGameOver]);

  const getX = useCallback((e: React.TouchEvent | React.MouseEvent): number => {
    const canvas = canvasRef.current;
    if (!canvas) return GAME_WIDTH / 2;
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;

    if ("touches" in e && e.touches.length > 0) {
      return (e.touches[0].clientX - rect.left) * scaleX;
    }
    if ("clientX" in e) {
      return (e.clientX - rect.left) * scaleX;
    }
    return GAME_WIDTH / 2;
  }, []);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!gameStarted || engineRef.current?.isGameOver) return;
    if (e.cancelable) e.preventDefault();
    isDraggingRef.current = true;
    dropXRef.current = getX(e);
  }, [gameStarted, getX]);

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    dropXRef.current = getX(e);
  }, [getX]);

  const handleEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    isDraggingRef.current = false;

    if (engineRef.current && !engineRef.current.isGameOver) {
      engineRef.current.addCoin(dropXRef.current);
      nextLevelRef.current = pickNextLevel();
    }
  }, [pickNextLevel]);

  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (engineRef.current?.isGameOver) return;

      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        dropXRef.current = Math.max(15, dropXRef.current - 20);
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        dropXRef.current = Math.min(GAME_WIDTH - 15, dropXRef.current + 20);
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (engineRef.current) {
          engineRef.current.addCoin(dropXRef.current);
          nextLevelRef.current = pickNextLevel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStarted, pickNextLevel]);

  useEffect(() => {
    if (!gameStarted) return;

    gameOverCalledRef.current = false;
    nextLevelRef.current = pickNextLevel();
    engineRef.current = createPhysicsEngine(onMerge);
    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [gameStarted, onMerge, gameLoop, pickNextLevel]);

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      className="rounded-xl border border-gray-800 cursor-pointer"
      style={{
        maxWidth: "100%",
        height: "auto",
        display: "block",
        margin: "0 auto",
        touchAction: "none"
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
    />
  );
}
