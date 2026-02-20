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

  const [scoreSaved, setScoreSaved] = useState(false);
  const [scoreSaveError, setScoreSaveError] = useState<string | null>(null);

  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const [isNewBest, setIsNewBest] = useState(false);

  const [gameKey, setGameKey] = useState(0);

  const [currentMode, setCurrentMode] = useState<"practice" | "tournament">("practice");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const context = await sdk.context;
        if (cancelled) return;

        const fidFromContext = context?.user?.fid ?? null;
        setFid(fidFromContext);

        const provider = await sdk.wallet.getEthereumProvider();
        if (provider) {
          try {
            const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
            const currentAddress = accounts?.[0] ?? null;
            if (currentAddress) setAddress(currentAddress);
          } catch {
            // ignore
          }
        }
      } catch (e) {
        console.error("Failed to load sdk context:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const resetGameStateAndStart = useCallback((targetMode: "practice" | "tournament") => {
    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setScoreSaved(false);
    setScoreSaveError(null);
    setRemainingAttempts(null);
    setIsNewBest(false);
    setGameKey((k) => k + 1);
    setScreen(targetMode);
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

      // Farcaster wallet (Farcaster clients + Base App)
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) {
          console.error("No provider");
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

        const getISOWeekKeyUTC = () => {
          const d = new Date();
          // ISO week date weeks start on Monday
          const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
          target.setUTCDate(target.getUTCDate() - dayNr + 3); // Thu of current week
          const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
          const firstDayNr = (firstThu.getUTCDay() + 6) % 7;
          firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNr + 3);
          const weekNo = 1 + Math.round((target.getTime() - firstThu.getTime()) / 604800000);
          const year = target.getUTCFullYear();
          return `${year}-W${String(weekNo).padStart(2, "0")}`;
        };

        const pendingKey = `farbase:pendingTournament:${currentAddress.toLowerCase()}:${getISOWeekKeyUTC()}`;

        const tryCompleteServerEntry = async () => {
          const res = await sdk.quickAuth.fetch("/api/create-entry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "tournament", address: currentAddress }),
          });
          if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(`create-entry failed: ${res.status} ${msg}`);
          }
        };

        // Eğer daha önce ödeme yapıldı ama entry yazılamadıysa, tekrar ödeme almadan entry'yi tamamla
        try {
          const raw = localStorage.getItem(pendingKey);
          if (raw) {
            const pending = JSON.parse(raw) as { createdAt: number };
            // 24 saatten eski pending'i yok say
            if (pending?.createdAt && Date.now() - pending.createdAt < 24 * 60 * 60 * 1000) {
              await tryCompleteServerEntry();
              localStorage.removeItem(pendingKey);
              resetGameStateAndStart("tournament");
              return;
            } else {
              localStorage.removeItem(pendingKey);
            }
          }
        } catch {
          // ignore
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

        // ✅ FIX: receipt'i in-app provider yerine public Base RPC'den oku
        const waitForTransaction = async (txHash: `0x${string}`) => {
          const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
          const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

          for (let attempts = 0; attempts < 90; attempts++) {
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

        // calldata
        const usdcInterface = new ethers.Interface([
          "function approve(address spender, uint256 amount)",
        ]);
        const approveData = usdcInterface.encodeFunctionData("approve", [
          CONTRACT_ADDRESS,
          1000000,
        ]);

        const contractInterface = new ethers.Interface(["function enterTournament(address token)"]);
        const enterData = contractInterface.encodeFunctionData("enterTournament", [USDC_ADDRESS]);

        // Prefer EIP-5792 batching (single prompt) when available
        let usedBatch = false;
        try {
          const caps = (await provider.request({
            method: "wallet_getCapabilities",
        params: [currentAddress as `0x${string}`],
          })) as any;

          const baseCaps = caps?.["0x2105"];
          const atomic = baseCaps?.atomic?.supported;
          const canBatch = atomic === "supported" || atomic === "ready";

          if (canBatch) {
            const sendRes = (await provider.request({
              method: "wallet_sendCalls",
              params: [
                {
                  version: "2.0.0",
                  from: currentAddress as `0x${string}`,
                  chainId: "0x2105",
                  atomicRequired: false,
                  calls: [
                    {
                      to: USDC_ADDRESS as `0x${string}`,
                      value: "0x0",
                      data: approveData as `0x${string}`,
                    },
                    {
                      to: CONTRACT_ADDRESS as `0x${string}`,
                      value: "0x0",
                      data: enterData as `0x${string}`,
                    },
                  ],
                },
              ],
            })) as any;

            const callsId =
              typeof sendRes === "string"
                ? sendRes
                : (sendRes?.batchId || sendRes?.callsId || sendRes?.id) as string | undefined;

            if (!callsId) throw new Error("wallet_sendCalls did not return callsId");

            // pending guard: ödeme alındıysa entry'yi tekrar dene, tekrar ödeme alma
            localStorage.setItem(pendingKey, JSON.stringify({ createdAt: Date.now(), callsId }));

            // Track batch status (Base App friendly)
            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
            let confirmed = false;
            for (let i = 0; i < 90; i++) {
              const status = (await provider.request({
                method: "wallet_getCallsStatus",
                params: [callsId],
              })) as any;

              if (status?.status === 200) {
                confirmed = true;
                break;
              }
              if (status?.status && status.status !== 100) {
                throw new Error(`Batch failed: ${status.status}`);
              }
              await sleep(1500);
            }
            if (!confirmed) {
              throw new Error("Batch confirmation timeout");
            }

            usedBatch = true;
          }
        } catch {
          usedBatch = false;
        }

        if (!usedBatch) {
          // 1) Approve USDC
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

          // pending guard (tx başarılıysa)
          localStorage.setItem(pendingKey, JSON.stringify({ createdAt: Date.now(), entryTxHash }));
        }

        // 3) Server entry (idempotent client-side retry)
        await tryCompleteServerEntry();
        localStorage.removeItem(pendingKey);

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

      {screen === "admin" && isAdmin && <AdminPanel fid={fid} onBack={() => setScreen("menu")} />}

      {(screen === "practice" || screen === "tournament") && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <Scoreboard
            mode={screen}
            score={score}
            mergeCount={mergeCount}
            highestLevel={highestLevel}
            remainingAttempts={remainingAttempts}
          />

          <div style={{ flex: 1, position: "relative" }}>
            <GameCanvas
              key={gameKey}
              mode={screen}
              fid={fid}
              address={address}
              onGameOver={async (log: GameLog) => {
                setGameOver(true);

                const finalScore = calculateScoreFromLog(log);
                setScore(finalScore);

                // highest level
                const maxLevel = log.reduce((acc, entry) => {
                  const coin = getCoinByLevel(entry.level);
                  return Math.max(acc, coin.level);
                }, 1);
                setHighestLevel(maxLevel);

                // merge count
                const merges = log.filter((e) => e.type === "merge").length;
                setMergeCount(merges);

                // save score
                try {
                  setScoreSaved(false);
                  setScoreSaveError(null);

                  const res = await sdk.quickAuth.fetch("/api/save-score", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      mode: screen,
                      score: finalScore,
                      mergeCount: merges,
                      highestLevel: maxLevel,
                      log,
                      address,
                    }),
                  });

                  const json = await res.json();
                  setScoreSaved(true);
                  setIsNewBest(!!json?.isNewBest);

                  if (typeof json?.remaining === "number") {
                    setRemainingAttempts(json.remaining);
                  }
                } catch (e: any) {
                  console.error("Failed to save score:", e);
                  setScoreSaveError(e?.message || "Failed to save score");
                }
              }}
            />

            {gameOver && (
              <GameOver
                mode={screen}
                score={score}
                mergeCount={mergeCount}
                highestLevel={highestLevel}
                scoreSaved={scoreSaved}
                scoreSaveError={scoreSaveError}
                remainingAttempts={remainingAttempts}
                isNewBest={isNewBest}
                onRestart={() => {
                  handleRestart();
                  if (currentMode === "practice") {
                    resetGameStateAndStart("practice");
                  } else {
                    resetGameStateAndStart("tournament");
                  }
                }}
                onBackToMenu={() => {
                  handleRestart();
                  setScreen("menu");
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
