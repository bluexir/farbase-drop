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

      // Cüzdan adresi al
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        const accounts = await provider.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
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

    // Score API'ye kaydet
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

  // Cast paylaşım
  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel);
      const text = `🪙 FarBase Drop'ta ${score} puan kazandım! En yüksek coin: ${coinData?.symbol || "DOGE"} 🔥\n\nOyna: https://farbase-drop.vercel.app`;
      
      await sdk.actions.composeCast({
        text,
        embeds: ["https://farbase-drop.vercel.app"],
      });
    } catch (e) {
      console.error("Cast error:", e);
    }
  }, [score, highestLevel]);

  const startGame = useCallback(async (mode: "practice" | "tournament") => {
    // Tournament için cüzdan kontrolü ve ödeme
    if (mode === "tournament") {
      if (!address) {
        // Cüzdan bağla
        try {
          const provider = await sdk.wallet.getEthereumProvider();
          const accounts = await provider.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            setAddress(accounts[0]);
          } else {
            alert("Cüzdan bağlanmadı");
            return;
          }
        } catch (e) {
          alert("Cüzdan bağlama başarısız");
          return;
        }
      }

      // 1 USDC ödeme
      try {
        const provider = await sdk.wallet.getEthereumProvider();

        // Base Mainnet'e switch
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }], // Base Mainnet
        });

        // USDC approve + enterTournament
        const USDC_ADDRESS = "0x833589fCD6e678d9Ab702236158911Df7a60662E"; // Base Mainnet USDC
        const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

        // approve
        const approveData = "0x095ea7b3" + // approve(address,uint256)
          CONTRACT_ADDRESS.slice(2).padStart(64, "0") +
          (1000000).toString(16).padStart(64, "0"); // 1 USDC = 1e6

        await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: address,
            to: USDC_ADDRESS,
            data: approveData,
          }],
        });

        // enterTournament
        const enterData = "0x" + // enterTournament() selector
          "a]93f7e"; // Function selector — deploy sonrası doğrulanacak

        await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: address,
            to: CONTRACT_ADDRESS,
            data: enterData,
          }],
        });
      } catch (e) {
        console.error("Tournament entry failed:", e);
        alert("Ödeme başarısız");
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

  // Loading
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

  // Ana Menü
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

  // Leaderboard
  if (screen === "leaderboard") {
    return <Leaderboard onBack={() => setScreen("menu")} />;
  }

  // Oyun Ekranı
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
      {/* Top bar */}
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

      {/* Scoreboard */}
      <div style={{ width: "100%", maxWidth: "424px" }}>
        <Scoreboard score={liveScore} mergeCount={mergeCount} highestLevel={highestLevel} />
      </div>

      {/* Game Canvas */}
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
