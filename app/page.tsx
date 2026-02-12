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
          console.error("Attempt check error:", e);
        }

        resetGameStateAndStart("practice");
        return;
      }

      // ── Tournament flow ──────────────────────────

      // Check admin status + remaining attempts
      let admin = false;
      let hasAttempts = false;
      try {
        const res = await sdk.quickAuth.fetch(
          "/api/remaining-attempts?mode=tournament"
        );
        const data = await res.json();
        admin = !!data.isAdmin;
        hasAttempts = data.remaining > 0;
        setIsAdmin(admin);
      } catch (e) {
        console.error("Tournament attempt check error:", e);
      }

      // If already has attempts, just play
      if (hasAttempts || admin) {
        // Still need wallet address for tournament leaderboard
        try {
          const provider = await sdk.wallet.getEthereumProvider();
          if (provider) {
            const accounts = (await provider.request({
              method: "eth_accounts",
            })) as string[];
            if (accounts?.[0]) setAddress(accounts[0]);
          }
        } catch {
          // Not critical if we already have attempts
        }

        if (admin) {
          // Admin: create entry without payment
          try {
            await sdk.quickAuth.fetch("/api/create-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "tournament",
                address: address || "",
              }),
            });
          } catch (e) {
            console.error("Admin entry creation error:", e);
          }
        }

        resetGameStateAndStart("tournament");
        return;
      }

      // ── Need to buy entry ────────────────────────

      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) {
          alert("Farcaster wallet required for tournament");
          return;
        }

        const accounts = (await provider.request({
          method: "eth_accounts",
        })) as string[];
        const currentAddress = accounts?.[0];
        if (!currentAddress) {
          alert("Please connect your wallet first");
          return;
        }
        setAddress(currentAddress);

        // Switch to Base
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        const USDC_ADDRESS =
          process.env.NEXT_PUBLIC_USDC_ADDRESS ||
          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

        if (!CONTRACT_ADDRESS) {
          alert("Contract address not configured");
          return;
        }

        const waitForTx = async (txHash: `0x${string}`) => {
          let attempts = 0;
          while (attempts < 30) {
            const receipt = (await provider.request({
              method: "eth_getTransactionReceipt",
              params: [txHash],
            })) as any;
            if (receipt?.status === "0x1") return;
            if (receipt?.status === "0x0")
              throw new Error("Transaction failed");
            await new Promise((r) => setTimeout(r, 2000));
            attempts++;
          }
          throw new Error("Transaction confirmation timeout");
        };

        const { ethers } = await import("ethers");

        // 1) Approve USDC
        const usdcIface = new ethers.Interface([
          "function approve(address spender, uint256 amount)",
        ]);
        const approveData = usdcIface.encodeFunctionData("approve", [
          CONTRACT_ADDRESS,
          1000000,
        ]);
        const approveTx = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: currentAddress as `0x${string}`,
              to: USDC_ADDRESS as `0x${string}`,
              data: approveData as `0x${string}`,
            },
          ],
        })) as `0x${string}`;
        await waitForTx(approveTx);

        // 2) Enter tournament
        const contractIface = new ethers.Interface([
          "function enterTournament(address token)",
        ]);
        const enterData = contractIface.encodeFunctionData(
          "enterTournament",
          [USDC_ADDRESS]
        );
        const entryTx = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: currentAddress as `0x${string}`,
              to: CONTRACT_ADDRESS as `0x${string}`,
              data: enterData as `0x${string}`,
            },
          ],
        })) as `0x${string}`;
        await waitForTx(entryTx);

        // 3) Create server entry
        await sdk.quickAuth.fetch("/api/create-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "tournament",
            address: currentAddress,
          }),
        });

        resetGameStateAndStart("tournament");
      } catch (e) {
        console.error("Tournament entry error:", e);
        alert(
          "Tournament entry failed. Please try again.\n" +
            (e instanceof Error ? e.message : String(e))
        );
      }
    },
    [resetGameStateAndStart, address]
  );

  // ── Restart (play again) ──────────────────────────

  const handleRestart = useCallback(() => {
    // Remaining attempts check is done server-side on save-score.
    // If no attempts left, save-score will fail and user sees error.
    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setScoreSaved(false);
    setScoreSaveError(null);
    setIsNewBest(false);
    setGameKey((k) => k + 1);
  }, []);

  // ── Loading ───────────────────────────────────────

  if (loading || fid === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#555",
          background: "#000",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "2rem",
              marginBottom: "12px",
              color: "#00f3ff",
              fontWeight: 800,
            }}
          >
            🪙
          </div>
          <p style={{ fontSize: "0.85rem" }}>Loading FarBase Drop...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh" }}>
      {screen === "menu" && (
        <MainMenu
          fid={fid}
          onPractice={() => startGame("practice")}
          onTournament={() => startGame("tournament")}
          onLeaderboard={() => setScreen("leaderboard")}
          onAdmin={isAdmin ? () => setScreen("admin") : undefined}
        />
      )}

      {screen === "leaderboard" && (
        <Leaderboard fid={fid} onBack={() => setScreen("menu")} />
      )}

      {screen === "admin" && (
        <AdminPanel onBack={() => setScreen("menu")} />
      )}

      {(screen === "practice" || screen === "tournament") && (
        <div style={{ padding: 16, position: "relative" }}>
          {!gameOver ? (
            <>
              <Scoreboard
                score={score}
                highestLevel={highestLevel}
                mergeCount={mergeCount}
              />
              <GameCanvas
                key={gameKey}
                mode={screen}
                gameStarted={true}
                fid={fid}
                sessionId={`${fid}-${gameKey}`}
                onMerge={handleMerge}
                onGameOver={handleGameOver}
              />
            </>
          ) : (
            <GameOver
              score={score}
              highestLevel={highestLevel}
              mergeCount={mergeCount}
              scoreSaved={scoreSaved}
              scoreSaveError={scoreSaveError}
              mode={currentMode}
              remaining={remainingAttempts}
              isNewBest={isNewBest}
              onRestart={handleRestart}
              onMenu={() => setScreen("menu")}
              onCast={handleCast}
            />
          )}
        </div>
      )}
    </div>
  );
}
