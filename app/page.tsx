"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import GameCanvas from "@/components/GameCanvas";
import Scoreboard from "@/components/Scoreboard";
import GameOver from "@/components/GameOver";
import MainMenu from "@/components/MainMenu";
import Leaderboard from "@/components/Leaderboard";
import { getCoinByLevel } from "@/lib/coins";

type Screen = "menu" | "practice" | "tournament" | "leaderboard";

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

      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (provider) {
          const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
          if (accounts && accounts.length > 0) {
            setAddress(accounts[0]);
          }
        }
      } catch (e) {
        console.warn("Wallet not connected");
      }

      await sdk.actions.ready();
      setLoading(false);
    }
    init();
  }, []);

  const handleMerge = useCallback((fromLevel: number, toLevel: number) => {
    setMergeCount((prev) => prev + 1);
    setHighestLevel((prev) => Math.max(prev, toLevel));
  }, []);

  const handleGameOver = useCallback(async (finalMerges: number, finalHighest: number) => {
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
        }),
      });
      setScoreSaved(true);
    } catch (e) {
      console.error("Failed to save score:", e);
    }
  }, [fid, address, currentMode]);

  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://farbase-drop.vercel.app";
      const text = `🪙 I just scored ${score} points on FarBase Drop! My highest coin reached: ${coinData?.symbol || "DOGE"} 🔥\n\nPlay now: ${appUrl}`;
      
      await sdk.actions.composeCast({
        text,
        embeds: [appUrl],
      });
    } catch (e) {
      console.error("Cast error:", e);
    }
  }, [score, highestLevel]);

  const startGame = useCallback(async (mode: "practice" | "tournament") => {
    if (mode === "tournament") {
      let currentAddress = address;

      if (!currentAddress) {
        try {
          const provider = await sdk.wallet.getEthereumProvider();
          if (provider) {
            const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
            if (accounts && accounts.length > 0) {
              setAddress(accounts[0]);
              currentAddress = accounts[0];
            } else {
              alert("Wallet not connected");
              return;
            }
          }
        } catch (e) {
          alert("Wallet connection failed");
          return;
        }
      }

      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) throw new Error("No provider");

        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }], 
        });

        const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

        const waitForTransaction = async (txHash: string) => {
          let confirmed = false;
          let attempts = 0;
          while (!confirmed && attempts < 30) {
            try {
              const receipt = await provider.request({
                method: "eth_getTransactionReceipt",
                params: [txHash],
              }) as any;
              
              if (receipt && receipt.status === "0x1") {
                confirmed = true;
              } else if (receipt && receipt.status === "0x0") {
                throw new Error("Transaction failed");
              } else {
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;
              }
            } catch (e) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              attempts++;
            }
          }
          if (!confirmed) throw new Error("Transaction confirmation timeout");
        };

        const { ethers } = await import("ethers");
        const usdcInterface = new ethers.Interface([
          "function approve(address spender, uint256 amount)"
        ]);
        const approveData = usdcInterface.encodeFunctionData("approve", [CONTRACT_ADDRESS, 1000000]);

        const approveTxHash = await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: currentAddress,
            to: USDC_ADDRESS,
            data: approveData,
          }],
        }) as string;

        await waitForTransaction(approveTxHash);

        const contractInterface = new ethers.Interface([
          "function enterTournament(address token)"
        ]);
        const enterData = contractInterface.encodeFunctionData("enterTournament", [USDC_ADDRESS]);

        const entryTxHash = await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: currentAddress,
            to: CONTRACT_ADDRESS,
            data: enterData,
          }],
        }) as string;

        await waitForTransaction(entryTxHash);

      } catch (e: any) {
        console.error("Tournament entry failed:", e);
        const errorMessage = e?.message || "Transaction failed";
        alert(`Tournament entry failed: ${errorMessage}`);
        return;
      }
    }

    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setCurrentMode(mode);
    setScreen(mode);
    setGameKey((prev) => prev + 1);
  }, [address]);

  const restartGame = useCallback(() => {
    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setGameKey((prev) => prev + 1);
  }, []);

  const liveScore = (getCoinByLevel(highestLevel)?.scoreValue || 1) * mergeCount;

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at center, #0a0a1a 0%, #000 100%)",
        }}
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            color: "#00f3ff",
            textShadow: "0 0 20px #00f3ff",
          }}
        >
          FarBase Drop
        </h1>
        <p style={{ color: "#555", marginTop: "8px" }}>Loading...</p>
      </div>
    );
  }

  if (screen === "menu") {
    return (
      <MainMenu
        fid={fid!}
        onPractice={() => startGame("practice")}
        onTournament={() => startGame("tournament")}
        onLeaderboard={() => setScreen("leaderboard")}
      />
    );
  }

  if (screen === "leaderboard") {
    return <Leaderboard onBack={() => setScreen("menu")} />;
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "424px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px 0 12px",
        }}
      >
        <button
          onClick={() => setScreen("menu")}
          style={{
            background: "none",
            border: "none",
            color: "#00f3ff",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          ← Menu
        </button>
        <span
          style={{
            color: currentMode === "tournament" ? "#ff00ff" : "#00f3ff",
            fontSize: "0.7rem",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {currentMode === "tournament" ? "🏆 Tournament" : "🎮 Practice"}
        </span>
        <div style={{ width: "50px" }} />
      </div>

      <div style={{ width: "100%", maxWidth: "424px" }}>
        <Scoreboard score={liveScore} mergeCount={mergeCount} highestLevel={highestLevel} />
      </div>

      <div style={{ position: "relative", width: "424px", flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
        <GameCanvas
          key={gameKey}
          onMerge={handleMerge}
          onGameOver={handleGameOver}
          gameStarted={true}
        />

        {gameOver && (
          <GameOver
            score={score}
            mergeCount={mergeCount}
            highestLevel={highestLevel}
            onRestart={restartGame}
            onCast={handleCast}
            scoreSaved={scoreSaved}
          />
        )}
      </div>
    </div>
  );
}
