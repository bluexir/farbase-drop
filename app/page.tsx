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

  const [gameKey, setGameKey] = useState(0);
  const [currentMode, setCurrentMode] = useState<"practice" | "tournament">("practice");
  const [scoreSaved, setScoreSaved] = useState(false);
  const [scoreSaveError, setScoreSaveError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const context = await sdk.context;
        setFid(context.user.fid);
        await sdk.actions.ready();

        // Admin kontrolu — menu acilir acilmaz admin butonu gozuksun
        try {
          const { token } = await sdk.quickAuth.getToken();
          const res = await fetch("/api/remaining-attempts?mode=practice", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = (await res.json()) as AttemptsResponse;
            if (data.isAdmin) setIsAdmin(true);
          }
        } catch (_e) {
          // Token alinamazsa admin kontrolu atlanir
        }
      } catch (e) {
        console.error("SDK init error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Kumulatif skor: her merge'de olusan coin'in score'u eklenir
  const handleMerge = useCallback((fromLevel: number, toLevel: number) => {
    const coinData = getCoinByLevel(toLevel);
    const increment = coinData?.score || 0;
    setScore((prev) => prev + increment);
    setMergeCount((prev) => prev + 1);
    setHighestLevel((prev) => Math.max(prev, toLevel));
  }, []);

  const handleGameOver = useCallback(
    async (finalMerges: number, finalHighest: number, gameLog: GameLog) => {
      setGameOver(true);

      // Kumulatif skor: game log'dan hesapla (server ile ayni formul)
      const calculated = calculateScoreFromLog(gameLog);
      const finalScore = calculated.score;

      setScore(finalScore);
      setMergeCount(finalMerges);
      setHighestLevel(finalHighest);
      setScoreSaved(false);
      setScoreSaveError(null);
      setRemainingAttempts(null);
      setIsNewBest(false);

      // Practice modunda wallet bagli olmayabilir
      const currentAddress = address || "0x0000000000000000000000000000000000000000";

      try {
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
          if (typeof data.remaining === "number") {
            setRemainingAttempts(data.remaining);
          }
          if (data.isNewBest) {
            setIsNewBest(true);
          }
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

  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel);
      const miniappUrl =
        process.env.NEXT_PUBLIC_MINIAPP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://farbase-drop.vercel.app";

      const text = `I just scored ${score} points on FarBase Drop! Highest coin: ${
        coinData?.symbol || "?"
      }\n\nPlay now: ${miniappUrl}`;

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

        const waitForTransaction = async (txHash: `0x${string}`) => {
          let attempts = 0;
          while (attempts < 30) {
            const receipt = (await provider.request({
              method: "eth_getTransactionReceipt",
              params: [txHash],
            })) as any;

            if (receipt && receipt.status === "0x1") return;
            if (receipt && receipt.status === "0x0") throw new Error("Transaction failed");

            await new Promise((r) => setTimeout(r, 2000));
            attempts++;
          }
          throw new Error("Transaction confirmation timeout");
        };

        const { ethers } = await import("ethers");

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
    [resetGameStateAndStart, address]
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
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      {screen === "menu" && (
        <MainMenu
          fid={fid}
          onPractice={() => startGame("practice")}
          onTournament={() => startGame("tournament")}
          onLeaderboard={() => setScreen("leaderboard")}
          onAdmin={isAdmin ? () => setScreen("admin") : undefined}
        />
      )}

      {screen === "leaderboard" && <Leaderboard fid={fid} onBack={() => setScreen("menu")} />}

      {screen === "admin" && <AdminPanel onBack={() => setScreen("menu")} />}

      {(screen === "practice" || screen === "tournament") && (
        <div
          style={{
            height: "100vh",
            overflow: "hidden",
            background: "radial-gradient(circle at center, #0a0a1a 0%, #000 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {!gameOver ? (
            <>
              <div style={{ flexShrink: 0, width: "100%", maxWidth: 550 }}>
                <Scoreboard score={score} highestLevel={highestLevel} mergeCount={mergeCount} />
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  width: "100%",
                }}
              >
                <GameCanvas
                  key={gameKey}
                  mode={screen}
                  gameStarted={true}
                  fid={fid}
                  sessionId={`${fid}-${gameKey}`}
                  onMerge={handleMerge}
                  onGameOver={handleGameOver}
                />
              </div>
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
