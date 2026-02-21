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

        // ✅ Lazy auth / Base preview safe: FID yoksa null
        const maybeFid = context?.user?.fid;
        setFid(typeof maybeFid === "number" ? maybeFid : null);

        await sdk.actions.ready();
        try {
          await sdk.actions.addMiniApp();
        } catch (_e) {}

        // ✅ Açılışta QuickAuth ZORLAMA YOK.
        // Admin / attempts gibi auth isteyen şeyleri UI (MainMenu) tarafında,
        // FID varsa ve gerektiğinde yapacağız.
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

      // ✅ Lazy auth: FID yoksa score save denemeyiz (Base preview'da patlamasın)
      if (fid === null) {
        setScoreSaveError("Sign-in required to save score.");
        return;
      }

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

      // ✅ Lazy auth: Tournament için FID şart (QuickAuth + attempts)
      if (fid === null) {
        console.error("Tournament requires FID (sign-in).");
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

        // ✅ receipt'i in-app provider yerine public Base RPC'den oku
        const waitForTransaction = async (txHash: `0x${string}`) => {
          const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
          const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

          for (let attempts = 0; attempts < 60; attempts++) {
            const res = await fetch(rpc, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getTransactionReceipt",
                params: [txHash],
              }),
            });

            const json = await res.json();
            const receipt = json?.result;

            if (receipt?.status === "0x1") return;
            if (receipt?.status === "0x0") throw new Error("Transaction failed");

            await sleep(1500);
          }

          throw new Error("Transaction confirmation timeout");
        };

        const { ethers } = await import("ethers");

        const usdcInterface = new ethers.Interface([
          "function approve(address spender, uint256 amount)",
        ]);
        const approveData = usdcInterface.encodeFunctionData("approve", [
          CONTRACT_ADDRESS,
          1000000,
        ]);

        const contractInterface = new ethers.Interface(["function enterTournament(address token)"]);
        const enterData = contractInterface.encodeFunctionData("enterTournament", [USDC_ADDRESS]);

        // ✅ EIP-5792 batch dene, desteklenmezse fallback 2 tx
        let batchWorked = false;
        try {
          const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";
          const batchParams: Record<string, unknown> = {
            version: "1.0",
            from: currentAddress,
            chainId: "0x2105",
            calls: [
              { to: USDC_ADDRESS, data: approveData, value: "0x0" },
              { to: CONTRACT_ADDRESS, data: enterData, value: "0x0" },
            ],
          };
          if (paymasterUrl) {
            batchParams.capabilities = {
              paymasterService: { url: paymasterUrl },
            };
          }

          const batchId = await provider.request({
            method: "wallet_sendCalls",
            params: [batchParams],
          });

          // Batch confirmation bekle
          for (let i = 0; i < 60; i++) {
            try {
              const status = (await provider.request({
                method: "wallet_getCallsStatus",
                params: [batchId],
              })) as { status?: string };
              if (status?.status === "CONFIRMED") break;
              if (status?.status === "FAILED") throw new Error("Batch transaction failed");
            } catch (_statusErr) {
              // wallet_getCallsStatus desteklenmeyebilir
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
          batchWorked = true;
        } catch (_batchErr) {
          // wallet_sendCalls desteklenmiyor — fallback 2 ayri tx
          batchWorked = false;
        }

        if (!batchWorked) {
          // Fallback: klasik 2 ayrı imza
        const approveTx = (await provider.request({
              method: "eth_sendTransaction",
              params: [{ from: currentAddress as `0x${string}`, to: USDC_ADDRESS as `0x${string}`, data: approveData as `0x${string}` }],
            })) as `0x${string}`;
            await waitForTransaction(approveTx);

            const entryTx = (await provider.request({
              method: "eth_sendTransaction",
              params: [{ from: currentAddress as `0x${string}`, to: CONTRACT_ADDRESS as `0x${string}`, data: enterData as `0x${string}` }],
            })) as `0x${string}`;
            await waitForTransaction(entryTx);

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
        }

        // ✅ Server entry — 3 retry
        let entryOk = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const entryRes = await sdk.quickAuth.fetch("/api/create-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "tournament", address: currentAddress }),
            });
            const entryData = await entryRes.json();
            if (entryRes.ok && entryData.success) {
              entryOk = true;
              break;
            }
          } catch (_retryErr) {
            // retry
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }

        if (!entryOk) {
          console.error("Failed to register entry after payment.");
        }

        resetGameStateAndStart("tournament");
      } catch (e) {
        console.error("Tournament entry failed:", e);
        return;
      }
    },
    [resetGameStateAndStart, address, fid]
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

  // ✅ Artık "fid === null" diye sonsuz loading yok.
  if (loading) {
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
          onLeaderboard={() => {
            // Leaderboard auth ister; FID yoksa gitme
            if (fid === null) return;
            setScreen("leaderboard");
          }}
          onAdmin={
            isAdmin && fid !== null
              ? () => setScreen("admin")
              : undefined
          }
        />
      )}

      {screen === "leaderboard" && fid !== null && (
        <Leaderboard fid={fid} onBack={() => setScreen("menu")} />
      )}

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
                  fid={fid ?? 0}
                  sessionId={`${fid ?? 0}-${gameKey}`}
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
