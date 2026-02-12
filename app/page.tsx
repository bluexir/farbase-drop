"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import GameCanvas from "@/components/GameCanvas";
import Scoreboard from "@/components/Scoreboard";
import GameOver from "@/components/GameOver";
import MainMenu from "@/components/MainMenu";
import Leaderboard from "@/components/Leaderboard";
import AdminPanel from "@/components/AdminPanel";
import { getCoinByLevel } from "@/lib/coins";
import { GameLog } from "@/lib/game-log";

type Screen = "menu" | "practice" | "tournament" | "leaderboard" | "admin";

export default function Home() {
  const [fid, setFid] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [screen, setScreen] = useState<Screen>("menu");
  const [gameOver, setGameOver] = useState(false);

  const [score, setScore] = useState(0);
  const [mergeCount, setMergeCount] = useState(0);
  const [highestLevel, setHighestLevel] = useState(1);

  const [gameKey, setGameKey] = useState(0);
  const [currentMode, setCurrentMode] = useState<"practice" | "tournament">(
    "practice"
  );
  const [scoreSaved, setScoreSaved] = useState(false);
  const [scoreSaveError, setScoreSaveError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );
  const [isNewBest, setIsNewBest] = useState(false);

  // ── Init ──────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const context = await sdk.context;
        setFid(context.user.fid);
        await sdk.actions.ready();
      } catch (e) {
        console.error("SDK init error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── Merge handler (cumulative scoring) ────────────

  const handleMerge = useCallback(
    (_fromLevel: number, toLevel: number, scoreIncrement: number) => {
      setScore((prev) => prev + scoreIncrement);
      setMergeCount((prev) => prev + 1);
      setHighestLevel((prev) => Math.max(prev, toLevel));
    },
    []
  );

  // ── Game Over handler ─────────────────────────────

  const handleGameOver = useCallback(
    async (
      finalScore: number,
      finalMerges: number,
      finalHighest: number,
      gameLog: GameLog
    ) => {
      setGameOver(true);
      setScore(finalScore);
      setMergeCount(finalMerges);
      setHighestLevel(finalHighest);
      setScoreSaved(false);
      setScoreSaveError(null);
      setRemainingAttempts(null);
      setIsNewBest(false);

      // Determine address for practice mode
      let currentAddress = address;
      if (!currentAddress) {
        // For practice mode, we might not have wallet connected.
        // Use a placeholder — score is still validated by FID.
        currentAddress = "0x0000000000000000000000000000000000000000";
      }

      try {
        // CRITICAL: Use quickAuth for authenticated save-score call
        const res = await sdk.quickAuth.fetch("/api/save-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: currentAddress,
            score: finalScore,
            mergeCount: finalMerges,
            highestLevel: finalHighest,
            mode: currentMode,
            gameLog,
            sessionId: `${fid}-${Date.now()}`,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setScoreSaved(true);
          setRemainingAttempts(
            typeof data.remaining === "number" ? data.remaining : null
          );
          setIsNewBest(!!data.isNewBest);
        } else {
          setScoreSaveError(data.error || "Failed to save score");
        }
      } catch (e) {
        console.error("Save score error:", e);
        setScoreSaveError("Network error — score not saved");
      }
    },
    [fid, address, currentMode]
  );

  // ── Cast handler ──────────────────────────────────

  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel);
      const miniappUrl =
        process.env.NEXT_PUBLIC_MINIAPP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://farbase-drop.vercel.app";

      const text = `🪙 I just scored ${score} points on FarBase Drop! Highest coin: ${
        coinData?.symbol || "?"
      } 🔥\n\nPlay now: ${miniappUrl}`;

      await sdk.actions.composeCast({
        text,
        embeds: [miniappUrl],
      });
    } catch (e) {
      console.error("Cast error:", e);
    }
  }, [score, highestLevel]);

  // ── Reset and start game ──────────────────────────

  const resetGameStateAndStart = useCallback((targetScreen: Screen) => {
    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setScoreSaved(false);
    setScoreSaveError(null);
    setRemainingAttempts(null);
    setIsNewBest(false);
    setGameKey((k) => k + 1);
    setScreen(targetScreen);
  }, []);

  // ── Start game (mode selection) ───────────────────

  const startGame = useCallback(
    async (mode: "practice" | "tournament") => {
      setCurrentMode(mode);

      if (mode === "practice") {
        // Practice: check remaining attempts first
        try {
          const res = await sdk.quickAuth.fetch(
            "/api/remaining-attempts?mode=practice"
          );
          const data = await res.json();
          setIsAdmin(!!data.isAdmin);
          if (!data.isAdmin && data.remaining <= 0) {
            alert("No practice attempts left today. Resets at UTC midnight.");
            return;
          }
        } catch (e) {
          console.error("Attempt
