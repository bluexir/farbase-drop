"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import GameCanvas from "@/components/GameCanvas";
import Scoreboard from "@/components/Scoreboard";
import GameOver from "@/components/GameOver";
import MainMenu from "@/components/MainMenu";
import Leaderboard from "@/components/Leaderboard";
import { getCoinByLevel } from "@/lib/coins";
import type { GameLog } from "@/lib/game-log";

type Screen = "menu" | "practice" | "tournament" | "leaderboard";

type RemainingAttemptsResponse = {
  mode: "practice" | "tournament";
  remaining: number;
  limit: number;
  isAdmin?: boolean;
  resetAt: number | null;
  resetInSeconds: number | null;
};

type UseAttemptResponse = {
  ok: boolean;
  mode: "practice" | "tournament";
  remaining: number;
  limit: number;
  isAdmin: boolean;
  resetAt: number | null;
  resetInSeconds: number | null;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("menu");
  const [fid, setFid] = useState<number | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [mergeCount, setMergeCount] = useState(0);
  const [highestLevel, setHighestLevel] = useState(1);
  const [scoreSaved, setScoreSaved] = useState(false);

  // Tournament state
  const [currentMode, setCurrentMode] = useState<"practice" | "tournament">("practice");
  const [address, setAddress] = useState<string | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize SDK
  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
        setSdkReady(true);

        const ctx = await sdk.getContext();
        if (ctx?.user?.fid) {
          setFid(ctx.user.fid);
        }
      } catch (err) {
        console.error("SDK init error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleCast = useCallback(async () => {
    try {
      const castText = `I just scored ${score} points in Farbase Drop! Can you beat my score? 🎮\n\nPlay now: https://farcaster.xyz/miniapps/Wh66UZgEFojt/unfollow-cleaner`;

      // MiniApp SDK cast composer
      await sdk.actions.openUrl(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`
      );
    } catch (error) {
      console.error("Failed to share cast:", error);
    }
  }, [score]);

  const handleMerge = useCallback((fromLevel: number, toLevel: number) => {
    // Merge sayısı + en yüksek seviye değişince, canlı skor da güncellensin.
    setMergeCount((prevMerges) => {
      const nextMerges = prevMerges + 1;

      setHighestLevel((prevHighest) => {
        const nextHighest = Math.max(prevHighest, toLevel);
        const coinData = getCoinByLevel(nextHighest);
        const nextScore = (coinData?.scoreValue || 1) * nextMerges;
        setScore(nextScore);
        return nextHighest;
      });

      return nextMerges;
    });
  }, []);

  const handleGameOver = useCallback(
    async (finalMerges: number, finalHighest: number, gameLog: GameLog) => {
      setGameOver(true);

      // Final score calculation
      const coinData = getCoinByLevel(finalHighest);
      const finalScore = (coinData?.scoreValue || 1) * finalMerges;
      setScore(finalScore);
      setScoreSaved(false);

      try {
        const sid = sessionId || `${fid ?? "anon"}-${Date.now()}`;

        const res = await sdk.quickAuth.fetch("/api/save-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // fid server-side token'dan geliyor
            address: currentMode === "tournament" ? address : undefined,
            score: finalScore,
            mergeCount: finalMerges,
            highestLevel: finalHighest,
            mode: currentMode,
            gameLog,
            sessionId: sid,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("save-score failed:", res.status, errText);
          return;
        }

        setScoreSaved(true);
      } catch (error) {
        console.error("Failed to save score:", error);
      }
    },
    [address, currentMode, fid, sessionId]
  );

  const resetGameStateAndStart = useCallback(
    (mode: "practice" | "tournament") => {
      setGameOver(false);
      setScore(0);
      setMergeCount(0);
      setHighestLevel(1);
      setScoreSaved(false);

      // yeni oyun oturumu
      const sid = `${fid ?? "anon"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setSessionId(sid);

      setGameKey((k) => k + 1);
      setCurrentMode(mode);
      setScreen(mode);
    },
    [fid]
  );

  const fetchRemaining = useCallback(async (mode: "practice" | "tournament") => {
    try {
      const res = await sdk.quickAuth.fetch(`/api/remaining-attempts?mode=${mode}`);
      if (!res.ok) return null;
      return (await res.json()) as RemainingAttemptsResponse;
    } catch (e) {
      console.error("remaining-attempts fetch error:", e);
      return null;
    }
  }, []);

  const consumeAttempt = useCallback(async (mode: "practice" | "tournament") => {
    try {
      const res = await sdk.quickAuth.fetch("/api/use-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) return null;
      return (await res.json()) as UseAttemptResponse;
    } catch (e) {
      console.error("use-attempt fetch error:", e);
      return null;
    }
  }, []);

  const ensureTournamentWalletReady = useCallback(async () => {
    // Wallet provider'ı al
    const provider = await sdk.wallet.getEthereumProvider();
    if (!provider) {
      throw new Error("No Ethereum provider available");
    }

    // Wallet address al
    const addrs = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];

    const currentAddress = addrs?.[0];
    if (!currentAddress) {
      throw new Error("No wallet address");
    }

    setAddress(currentAddress);

    // Base chain (8453)
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x2105" }],
    });

    return { provider, currentAddress };
  }, []);

  const startGame = useCallback(
    async (mode: "practice" | "tournament") => {
      if (!sdkReady) return;

      if (mode === "practice") {
        const rem = await fetchRemaining("practice");
        if (!rem || rem.remaining <= 0) {
          return;
        }

        const used = await consumeAttempt("practice");
        if (!used || !used.ok) {
          return;
        }

        resetGameStateAndStart("practice");
        return;
      }

      // tournament
      try {
        // Wallet hazır (admin dahil)
        const { provider, currentAddress } = await ensureTournamentWalletReady();

        const rem = await fetchRemaining("tournament");
        if (rem && rem.remaining > 0) {
          // active entry var → direkt attempt tüket ve başla
          const used = await consumeAttempt("tournament");
          if (!used || !used.ok) return;
          resetGameStateAndStart("tournament");
          return;
        }

        // Remaining 0 → entry + payment
        // Payment transaction
        const txHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: currentAddress,
              to: "0x4AcCc84aF23912073A5cA6F6b1ed9F1E3E4a3Bd6", // Replace with your address
              value: "0x2386F26FC10000", // 0.01 ETH
              gas: "0x5208", // 21000
            },
          ],
        })) as string;

        if (!txHash) {
          throw new Error("Transaction failed");
        }

        // Create tournament entry on server
        const entryRes = await sdk.quickAuth.fetch("/api/create-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: currentAddress,
            txHash,
          }),
        });

        if (!entryRes.ok) {
          const errText = await entryRes.text();
          console.error("create-entry failed:", entryRes.status, errText);
          return;
        }

        // Attempt tüket ve başla
        const used = await consumeAttempt("tournament");
        if (!used || !used.ok) {
          return;
        }

        resetGameStateAndStart("tournament");
      } catch (error) {
        console.error("Tournament entry failed:", error);
      }
    },
    [
      address,
      consumeAttempt,
      ensureTournamentWalletReady,
      fetchRemaining,
      resetGameStateAndStart,
      sdkReady,
    ]
  );

  const handleRestart = useCallback(async () => {
    if (screen !== "practice" && screen !== "tournament") return;

    const mode: "practice" | "tournament" = screen;

    // Restart = yeni attempt
    const used = await consumeAttempt(mode);
    if (!used || !used.ok) {
      // attempt yoksa menüye dön
      setScreen("menu");
      return;
    }

    resetGameStateAndStart(mode);
  }, [consumeAttempt, resetGameStateAndStart, screen]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Farbase Drop...</h1>
          <p className="text-gray-400">Initializing MiniApp SDK</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-xl font-bold">Farbase Drop</h1>
          {fid && <div className="text-sm text-gray-400">FID: {fid}</div>}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4">
        {screen === "menu" && (
          <MainMenu
            fid={fid || 0}
            onStartPractice={() => startGame("practice")}
            onStartTournament={() => startGame("tournament")}
            onViewLeaderboard={() => setScreen("leaderboard")}
          />
        )}

        {screen === "leaderboard" && (
          <Leaderboard onBack={() => setScreen("menu")} currentFid={fid || 0} />
        )}

        {(screen === "practice" || screen === "tournament") && (
          <div className="space-y-4">
            {/* Scoreboard */}
            <Scoreboard
              score={score}
              mergeCount={mergeCount}
              highestLevel={highestLevel}
              mode={screen}
            />

            {/* Game Canvas */}
            <GameCanvas
              key={gameKey}
              mode={screen}
              onMerge={handleMerge}
              onGameOver={handleGameOver}
              onBackToMenu={() => setScreen("menu")}
              gameStarted={true}
              fid={fid || 0}
              sessionId={sessionId || `${fid || 0}-${gameKey}`}
            />

            {/* Game Over Screen */}
            {gameOver && (
              <GameOver
                score={score}
                mergeCount={mergeCount}
                highestLevel={highestLevel}
                mode={screen}
                scoreSaved={scoreSaved}
                onRestart={handleRestart}
                onBackToMenu={() => setScreen("menu")}
                onShare={handleCast}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-500 text-sm">
        <p>Built with Farcaster MiniApp SDK</p>
      </footer>
    </main>
  );
}
