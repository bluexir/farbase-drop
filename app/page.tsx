"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import GameCanvas from "@/components/GameCanvas";
import Scoreboard from "@/components/Scoreboard";
import GameOver from "@/components/GameOver";
import MainMenu from "@/components/MainMenu";
import Leaderboard from "@/components/Leaderboard";
import { getCoinByLevel } from "@/lib/coins";
import { GameLog } from "@/lib/game-log";

type Screen = "menu" | "practice" | "tournament" | "leaderboard";

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

  const [screen, setScreen] = useState<Screen>("menu");
  const [gameOver, setGameOver] = useState(false);

  const [score, setScore] = useState(0);
  const [mergeCount, setMergeCount] = useState(0);
  const [highestLevel, setHighestLevel] = useState(1);

  const [gameKey, setGameKey] = useState(0);
  const [currentMode, setCurrentMode] = useState<"practice" | "tournament">("practice");
  const [scoreSaved, setScoreSaved] = useState(false);

  useEffect(() => {
    async function init() {
      const context = await sdk.context;
      setFid(context.user.fid);

      // ÖNEMLİ: Uygulama açılışında wallet init etmiyoruz.
      // Tournament'e basınca gerektiğinde alacağız.
      await sdk.actions.ready();
      setLoading(false);
    }
    init();
  }, []);

  const handleMerge = useCallback((fromLevel: number, toLevel: number) => {
    setMergeCount((prev) => prev + 1);
    setHighestLevel((prev) => Math.max(prev, toLevel));
  }, []);

  const handleGameOver = useCallback(
    async (finalMerges: number, finalHighest: number, gameLog: GameLog) => {
      setGameOver(true);

      const coinData = getCoinByLevel(finalHighest);
      const finalScore = (coinData?.scoreValue || 1) * finalMerges;

      setScore(finalScore);
      setMergeCount(finalMerges);
      setHighestLevel(finalHighest);
      setScoreSaved(false);

      try {
        await fetch("/api/save-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fid,
            address,
            score: finalScore,
            mergeCount: finalMerges,
            highestLevel: finalHighest,
            mode: currentMode,
            gameLog,
            sessionId: `${fid}-${Date.now()}`,
          }),
        });
        setScoreSaved(true);
      } catch (e) {
        console.error("Failed to save score:", e);
      }
    },
    [fid, address, currentMode]
  );

  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel);

      // İstediğin canonical link:
      // https://farcaster.xyz/miniapps/Wh66UZgEFojt/unfollow-cleaner
      // Bu oyun için de aynı mantık: canonical miniapp link'i ENV'den okut.
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

  const resetGameStateAndStart = useCallback((targetScreen: Screen) => {
    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setScoreSaved(false);
    setGameKey((k) => k + 1);
    setScreen(targetScreen);
  }, []);

  const startGame = useCallback(
    async (mode: "practice" | "tournament") => {
      setCurrentMode(mode);

      // Practice: daily attempts server-side, create-entry gerekmiyor
      if (mode === "practice") {
        resetGameStateAndStart("practice");
        return;
      }

      // Tournament: önce admin mi kontrol et (server-side)
      let isAdmin = false;
      try {
        const res = await sdk.quickAuth.fetch("/api/remaining-attempts?mode=tournament");
        const data = (await res.json()) as AttemptsResponse;
        isAdmin = !!data.isAdmin;
      } catch (e) {
        console.error("Failed to check admin status:", e);
      }

      // Tournament: Farcaster wallet address almalıyız (sadece Farcaster wallet istiyoruz)
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) {
          console.error("No Farcaster provider");
          return;
        }

        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        const currentAddress = accounts?.[0];
        if (!currentAddress) {
          console.error("Wallet not connected");
          return;
        }

        setAddress(currentAddress);

        // Base chain switch (admin de olsa doğru networkte olsun)
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        // ✅ ADMIN TEST MODU:
        // Ödeme/approve/enterTournament tx YOK.
        // Sadece server tarafında entry açıyoruz ve oyunu başlatıyoruz.
        if (isAdmin) {
          await sdk.quickAuth.fetch("/api/create-entry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "tournament", address: currentAddress }),
          });

          resetGameStateAndStart("tournament");
          return;
        }

        // ✅ NORMAL KULLANICI:
        // Ödeme + tx + server create-entry
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

        // 1) approve USDC
        const usdcInterface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
        const approveData = usdcInterface.encodeFunctionData("approve", [CONTRACT_ADDRESS, 1000000]);

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

        // 2) enterTournament
        const contractInterface = new ethers.Interface(["function enterTournament(address token)"]);
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

        // 3) server create-entry (auth'lu)
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
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {screen === "menu" && (
        <MainMenu
          fid={fid}
          onPractice={() => startGame("practice")}
          onTournament={() => startGame("tournament")}
          onLeaderboard={() => setScreen("leaderboard")}
        />
      )}

      {screen === "leaderboard" && <Leaderboard onBack={() => setScreen("menu")} />}

      {(screen === "practice" || screen === "tournament") && (
        <div style={{ padding: 16 }}>
          {!gameOver ? (
            <>
              <Scoreboard score={score} highestLevel={highestLevel} mergeCount={mergeCount} />
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
              mode={screen}
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
