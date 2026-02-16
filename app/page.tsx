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
import { GameLog, calculateScoreFromLog } from "@/lib/game-log";

type Screen = "menu" | "practice" | "tournament" | "leaderboard" | "admin";

type AttemptsResponse = {
  mode: "practice" | "tournament";
  remaining: number;
  limit: number;
  isAdmin: boolean;
  resetAt: number | null;
  resetInSeconds: number | null;
};

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

  const [currentMode, setCurrentMode] = useState<"practice" | "tournament">("practice");
  const [gameKey, setGameKey] = useState(0);

  const [scoreSaved, setScoreSaved] = useState(false);
  const [scoreSaveError, setScoreSaveError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await sdk.actions.ready();
        const ctx = await sdk.context;
        setFid(ctx.user?.fid ?? null);
      } catch (e) {
        console.error("SDK init error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel);
      const miniappUrl =
        process.env.NEXT_PUBLIC_MINIAPP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://farbase-drop.vercel.app";

      const text = `I just scored ${score} points on FarBase Drop! Highest coin: ${
        coinData?.symbol || "?"
      }\n\nPlay now: ${miniappUrl}\n\nBy @bluexir`;

      await sdk.actions.composeCast({
        text,
        embeds: [miniappUrl],
      });
    } catch (e) {
      console.error("Cast error:", e);
    }
  }, [score, highestLevel]);

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

  const startGame = useCallback(
    async (mode: "practice" | "tournament") => {
      setCurrentMode(mode);

      if (mode === "practice") {
        resetGameStateAndStart("practice");
        return;
      }

      // Tournament: attempt kontrolu
      let hasAttempts = false;
      try {
        const res = await sdk.quickAuth.fetch("/api/remaining-attempts?mode=tournament");
        const data = (await res.json()) as AttemptsResponse;
        hasAttempts = data.remaining > 0;
        setIsAdmin(!!data.isAdmin);
      } catch (e) {
        console.error("Failed to check tournament status:", e);
      }

      // Farcaster wallet
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) {
          console.error("No Farcaster provider");
          return;
        }

        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        const currentAddress = accounts?.[0];
        if (!currentAddress) {
          console.error("Wallet not connected");
          return;
        }
        setAddress(currentAddress);

        // Base chain
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        // Zaten hakki varsa direkt oyna
        if (hasAttempts) {
          resetGameStateAndStart("tournament");
          return;
        }

        // Yeni entry satin al (admin dahil herkes oder)
        const USDC_ADDRESS =
          process.env.NEXT_PUBLIC_USDC_ADDRESS ||
          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

        const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
        if (!CONTRACT_ADDRESS) {
          console.error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
          return;
        }

        const { ethers } = await import("ethers");

        const waitForTransaction = async (txHash: `0x${string}`) => {
          // IMPORTANT: Farcaster/Base in-app providers may NOT support eth_getTransactionReceipt reliably.
          // If we poll receipts via the in-app provider, we can get stuck after "Approve" and never reach tx #2.
          const rpc =
            process.env.NEXT_PUBLIC_BASE_RPC_URL ||
            process.env.BASE_MAINNET_RPC_URL ||
            "https://mainnet.base.org";
          const publicProvider = new ethers.JsonRpcProvider(rpc);

          let attempts = 0;
          while (attempts < 60) {
            const receipt = await publicProvider.getTransactionReceipt(txHash);
            if (receipt && receipt.status === 1) return;
            if (receipt && receipt.status === 0) throw new Error("Transaction failed");
            await new Promise((r) => setTimeout(r, 1500));
            attempts++;
          }
          throw new Error("Transaction confirmation timeout");
        };

        // 1) Approve USDC
        const usdcInterface = new ethers.Interface([
          "function approve(address spender, uint256 amount)",
        ]);
        const approveData = usdcInterface.encodeFunctionData("approve", [
          CONTRACT_ADDRESS,
          1000000,
        ]);

        const approveTxHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: currentAddress as `0x${string}`,
              to: USDC_ADDRESS as `0x${string}`,
              data: approveData as `0x${string}`,
            },
          ],
        })) as `0x${string}`;
        await waitForTransaction(approveTxHash);

        // 2) Enter tournament
        const contractInterface = new ethers.Interface([
          "function enterTournament(address token)",
        ]);
        const enterData = contractInterface.encodeFunctionData("enterTournament", [USDC_ADDRESS]);

        const entryTxHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: currentAddress as `0x${string}`,
              to: CONTRACT_ADDRESS as `0x${string}`,
              data: enterData as `0x${string}`,
            },
          ],
        })) as `0x${string}`;
        await waitForTransaction(entryTxHash);

        // 3) Server entry
        await sdk.quickAuth.fetch("/api/create-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "tournament", address: currentAddress }),
        });

        resetGameStateAndStart("tournament");
      } catch (e) {
        console.error("Tournament entry failed:", e);
        return;
      }
    },
    [resetGameStateAndStart]
  );

  const handleRestart = useCallback(() => {
    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setScoreSaved(false);
    setScoreSaveError(null);
    setRemainingAttempts(null);
    setIsNewBest(false);
    setGameKey((k) => k + 1);
  }, []);

  const handleGameOver = useCallback(
    async (mergeCountValue: number, highestLevelValue: number, gameLog: GameLog) => {
      setGameOver(true);
      setMergeCount(mergeCountValue);
      setHighestLevel(highestLevelValue);

      const computedScore = calculateScoreFromLog(gameLog);
      setScore(computedScore);

      try {
        const res = await sdk.quickAuth.fetch("/api/save-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: currentMode,
            score: computedScore,
            mergeCount: mergeCountValue,
            highestLevel: highestLevelValue,
            gameLog,
            address,
          }),
        });

        const data = await res.json();
        setScoreSaved(true);
        setRemainingAttempts(data.remaining ?? null);
        setIsNewBest(!!data.isNewBest);
      } catch (e: any) {
        setScoreSaveError(e?.message || "Failed to save score");
      }
    },
    [currentMode, address]
  );

  if (loading || fid === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          background: "#000",
          fontFamily: "sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      {screen === "menu" && (
        <MainMenu
          fid={fid}
          onPractice={() => startGame("practice")}
          onTournament={() => startGame("tournament")}
          onLeaderboard={() => setScreen("leaderboard")}
          onAdmin={() => setScreen("admin")}
        />
      )}

      {screen === "leaderboard" && <Leaderboard fid={fid} onBack={() => setScreen("menu")} />}

      {screen === "admin" && <AdminPanel onBack={() => setScreen("menu")} />}

      {(screen === "practice" || screen === "tournament") && (
        <div style={{ position: "relative", width: "100%", height: "100vh" }}>
          <Scoreboard
            mode={currentMode}
            score={score}
            mergeCount={mergeCount}
            highestLevel={highestLevel}
            onBack={() => setScreen("menu")}
          />

          <GameCanvas
            key={gameKey}
            fid={fid}
            mode={currentMode}
            sessionId={`${fid}-${Date.now()}-${currentMode}`}
            gameStarted={!gameOver}
            onMerge={(fromLevel, toLevel) => {
              setMergeCount((c) => c + 1);
              setHighestLevel((h) => Math.max(h, toLevel));
              const coinData = getCoinByLevel(toLevel);
              if (coinData) setScore((s) => s + coinData.score);
            }}
            onGameOver={handleGameOver}
          />

          {gameOver && (
            <GameOver
              fid={fid}
              mode={currentMode}
              score={score}
              mergeCount={mergeCount}
              highestLevel={highestLevel}
              scoreSaved={scoreSaved}
              scoreSaveError={scoreSaveError}
              remainingAttempts={remainingAttempts}
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
