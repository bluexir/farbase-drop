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

        const USDC_ADDRESS =
          process.env.NEXT_PUBLIC_USDC_ADDRESS ||
          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

        const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
        if (!CONTRACT_ADDRESS) {
          console.error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
          return;
        }

        // Receipt'i in-app provider yerine public Base RPC'den oku (sponsor/provider farkları için)
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

        // ---- Purchase metadata (idempotency + resume) ----
        const getISOWeekKeyUTC = () => {
          const d = new Date();
          const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
          target.setUTCDate(target.getUTCDate() - dayNr + 3); // Thu
          const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
          const firstDayNr = (firstThu.getUTCDay() + 6) % 7;
          firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNr + 3);
          const weekNo = 1 + Math.round((target.getTime() - firstThu.getTime()) / 604800000);
          const year = target.getUTCFullYear();
          return `${year}-W${String(weekNo).padStart(2, "0")}`;
        };

        const weekKey = getISOWeekKeyUTC();
        const pendingKey = `farbase:pendingTournament:${currentAddress.toLowerCase()}:${weekKey}`;

        const genPurchaseId = () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c: any = globalThis.crypto;
            if (c?.randomUUID) return c.randomUUID();
          } catch {}
          return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        };

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const tryCompleteServerEntry = async (purchaseId: string) => {
          // create-entry server-side idempotent by purchaseId
          for (let i = 0; i < 10; i++) {
            const res = await sdk.quickAuth.fetch("/api/create-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "tournament",
                address: currentAddress,
                purchaseId,
              }),
            });

            if (res.status === 202) {
              await sleep(1000);
              continue;
            }

            if (!res.ok) {
              const msg = await res.text().catch(() => "");
              throw new Error(`create-entry failed: ${res.status} ${msg}`);
            }
            return;
          }
          throw new Error("create-entry still processing");
        };

        // If we previously PAID but entry creation failed (network/app close),
        // resume without charging again.
        try {
          const raw = localStorage.getItem(pendingKey);
          if (raw) {
            const pending = JSON.parse(raw) as {
              createdAt: number;
              purchaseId: string;
              stage?: "initiated" | "paid";
            };
            if (
              pending?.purchaseId &&
              pending?.createdAt &&
              pending?.stage === "paid" &&
              Date.now() - pending.createdAt < 24 * 60 * 60 * 1000
            ) {
              await tryCompleteServerEntry(pending.purchaseId);
              localStorage.removeItem(pendingKey);
              resetGameStateAndStart("tournament");
              return;
            } else if (pending?.stage !== "paid") {
              // initiated-but-not-paid: temizle (cancelled / failed)
              localStorage.removeItem(pendingKey);
            }
          }
        } catch {
          // ignore
        }

        // Prepare calldata
        const usdcInterface = new ethers.Interface([
          "function approve(address spender, uint256 amount)",
        ]);
        const approveData = usdcInterface.encodeFunctionData("approve", [
          CONTRACT_ADDRESS,
          1000000,
        ]);

        const contractInterface = new ethers.Interface(["function enterTournament(address token)"]);
        const enterData = contractInterface.encodeFunctionData("enterTournament", [USDC_ADDRESS]);

        // New purchaseId for this attempt (stable across retries via localStorage)
        const purchaseId = genPurchaseId();
        const pendingCreatedAt = Date.now();
        localStorage.setItem(
          pendingKey,
          JSON.stringify({ createdAt: pendingCreatedAt, purchaseId, stage: "initiated" })
        );

        // ---- Prefer EIP-5792 batching (single prompt) when available ----
        let usedBatch = false;

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p: any = provider;

          const caps = await p.request({
            method: "wallet_getCapabilities",
            params: [currentAddress],
          });

          const baseCaps = caps?.["0x2105"];
          const atomic = baseCaps?.atomic?.supported;
          const canBatch = atomic === "supported" || atomic === "ready";

          if (canBatch) {
            const sendRes = await p.request({
              method: "wallet_sendCalls",
              params: [
                {
                  version: "2.0.0",
                  from: currentAddress,
                  chainId: "0x2105",
                  calls: [
                    { to: USDC_ADDRESS, data: approveData, value: "0x0" },
                    { to: CONTRACT_ADDRESS, data: enterData, value: "0x0" },
                  ],
                },
              ],
            });

            const callsId =
              typeof sendRes === "string"
                ? sendRes
                : sendRes?.batchId || sendRes?.callsId || sendRes?.id;

            if (!callsId) throw new Error("wallet_sendCalls did not return callsId");

            // Wait for batch confirmation
            let confirmed = false;
            for (let i = 0; i < 90; i++) {
              const status = await p.request({
                method: "wallet_getCallsStatus",
                params: [callsId],
              });

              if (status?.status === 200) {
                confirmed = true;
                break;
              }
              if (status?.status && status.status !== 100) {
                throw new Error(`Batch failed: ${status.status}`);
              }
              await sleep(1500);
            }

            if (!confirmed) throw new Error("Batch confirmation timeout");

            // Mark paid (so we can resume create-entry without re-charging)
            localStorage.setItem(
              pendingKey,
              JSON.stringify({ createdAt: pendingCreatedAt, purchaseId, stage: "paid" })
            );

            usedBatch = true;
          }
        } catch {
          usedBatch = false;
        }

        // ---- Fallback: two transactions ----
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

          // Mark paid
          localStorage.setItem(
            pendingKey,
            JSON.stringify({ createdAt: pendingCreatedAt, purchaseId, stage: "paid" })
          );
        }

        // 3) Server entry (idempotent, safe to retry)
        await tryCompleteServerEntry(purchaseId);
        localStorage.removeItem(pendingKey);

        resetGameStateAndStart("tournament");
      } catch (e) {
        // initiated-but-not-paid pending'i temizle (paid ise kalsın ki resume olsun)
        try {
          if (typeof window !== "undefined" && address) {
            const d = new Date();
            const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
            const dayNr = (target.getUTCDay() + 6) % 7;
            target.setUTCDate(target.getUTCDate() - dayNr + 3);
            const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
            const firstDayNr = (firstThu.getUTCDay() + 6) % 7;
            firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNr + 3);
            const weekNo = 1 + Math.round((target.getTime() - firstThu.getTime()) / 604800000);
            const year = target.getUTCFullYear();
            const weekKey = `${year}-W${String(weekNo).padStart(2, "0")}`;
            const k = `farbase:pendingTournament:${address.toLowerCase()}:${weekKey}`;
            const raw = localStorage.getItem(k);
            if (raw) {
              const pending = JSON.parse(raw) as { stage?: string };
              if (pending?.stage !== "paid") localStorage.removeItem(k);
            }
          }
        } catch {}
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
                  onMerge={(fromLevel, toLevel) => {
                    const toCoin = getCoinByLevel(toLevel);
                    setScore((s) => s + (toCoin?.score || 0));
                    setMergeCount((m) => m + 1);
                    setHighestLevel((h) => Math.max(h, toLevel));
                  }}
                  onGameOver={async (finalMergeCount, finalHighestLevel, log: GameLog) => {
                    setGameOver(true);
                    const result = calculateScoreFromLog(log);
                    setScore(result.score);
                    setMergeCount(finalMergeCount);
                    setHighestLevel(finalHighestLevel);

                    setScoreSaved(false);
                    setScoreSaveError(null);
                    setIsNewBest(false);

                    try {
                      const res = await sdk.quickAuth.fetch("/api/save-score", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          mode: screen,
                          score: result.score,
                          mergeCount: finalMergeCount,
                          highestLevel: finalHighestLevel,
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
              onCast={async () => {
                try {
                  const miniappUrl =
                    process.env.NEXT_PUBLIC_MINIAPP_URL ||
                    process.env.NEXT_PUBLIC_APP_URL ||
                    "https://farbase-drop.vercel.app";

                  await sdk.actions.composeCast({
                    text: `I scored ${score} on FarBase Drop. Highest: ${getCoinByLevel(highestLevel)?.symbol || "?"}\n\nPlay: ${miniappUrl}`,
                    embeds: [miniappUrl],
                  });
                } catch (e) {
                  console.error("Cast failed:", e);
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
