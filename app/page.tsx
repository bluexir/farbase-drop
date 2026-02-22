"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import GameCanvas from "@/components/GameCanvas";
import Scoreboard from "@/components/Scoreboard";
import GameOver from "@/components/GameOver";
import MainMenu from "@/components/MainMenu";
import Leaderboard from "@/components/Leaderboard";
import AdminPanel from "@/components/AdminPanel";
import { getCoinByLevel, Platform } from "@/lib/coins";
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

type PendingPurchase = {
  createdAt: number;
  purchaseId: string;
  stage: "initiated" | "paid";
  method?: "batch" | "fallback";
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// UTC Monday 00:00 week key (same idea as leaderboard)
function getWeekKeyUTC() {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const day = utc.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);

  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function genPurchaseId() {
  try {
    const c: any = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {}
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function detectPlatform(context: any): Platform {
  // 1) Context hints (best-effort)
  try {
    const clientObj = context?.client ?? context?.frame?.client ?? context?.app?.client ?? context?.platform ?? context?.client?.platform ?? context?.client?.name;
    const s = JSON.stringify(clientObj ?? "").toLowerCase();
    if (s.includes("base")) return "base";
  } catch {}

  // 2) Browser hints (more deterministic for Base App webview)
  try {
    const ref = (document.referrer || "").toLowerCase();
    if (ref.includes("base.app")) return "base";
    const ao = (window.location as any)?.ancestorOrigins;
    if (ao && ao.length) {
      for (let i = 0; i < ao.length; i++) {
        const v = String(ao[i]).toLowerCase();
        if (v.includes("base.app")) return "base";
      }
    }
  } catch {}

  return "farcaster";
}

async function tryCreateEntryWithRetry(address: string, purchaseId: string) {
  for (let i = 0; i < 8; i++) {
    const res = await sdk.quickAuth.fetch("/api/create-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "tournament", address, purchaseId }),
    });

    if (res.status === 202) {
      await sleep(900);
      continue;
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) return true;
    return false;
  }
  return false;
}

export default function Home() {
  const [fid, setFid] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [platform, setPlatform] = useState<Platform>("farcaster");

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

        const maybeFid = context?.user?.fid;
        setFid(typeof maybeFid === "number" ? maybeFid : null);

        setPlatform(detectPlatform(context));

        await sdk.actions.ready();
        try {
          await sdk.actions.addMiniApp();
        } catch {}
      } catch (e) {
        console.error("SDK init error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleMerge = useCallback((fromLevel: number, toLevel: number) => {
    // scoring logic unchanged
    const coinData = getCoinByLevel(toLevel);
    const increment = coinData?.score || 0;
    setScore((prev) => prev + increment);
    setMergeCount((prev) => prev + 1);
    setHighestLevel((prev) => Math.max(prev, toLevel));
  }, []);

  const handleGameOver = useCallback(
    async (finalMerges: number, finalHighest: number, gameLog: GameLog) => {
      setGameOver(true);

      const calculated = calculateScoreFromLog(gameLog);
      const finalScore = calculated.score;

      setScore(finalScore);
      setMergeCount(finalMerges);
      setHighestLevel(finalHighest);
      setScoreSaved(false);
      setScoreSaveError(null);
      setRemainingAttempts(null);
      setIsNewBest(false);

      const currentAddress = address || "0x0000000000000000000000000000000000000000";

      // NOTE: Base App scoring auth can be added later (address-based).
      // For now we keep existing QuickAuth behavior.
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
          if (typeof data.remaining === "number") setRemainingAttempts(data.remaining);
          if (data.isNewBest) setIsNewBest(true);
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
      const coinData = getCoinByLevel(highestLevel, platform);
      const miniappUrl =
        process.env.NEXT_PUBLIC_MINIAPP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://farbase-drop.vercel.app";

      const text = `I just scored ${score} points on FarBase Drop! Highest coin: ${
        coinData?.symbol || "?"
      }\n\nPlay now: ${miniappUrl}\n\nBy @bluexir`;

      await sdk.actions.composeCast({ text, embeds: [miniappUrl] });
    } catch (e) {
      console.error("Cast error:", e);
    }
  }, [score, highestLevel, platform]);

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

      if (fid === null) {
        console.error("Tournament requires FID (sign-in).");
        return;
      }

      let hasAttempts = false;
      try {
        const res = await sdk.quickAuth.fetch("/api/remaining-attempts?mode=tournament");
        const data = (await res.json()) as AttemptsResponse;
        hasAttempts = data.remaining > 0;
        setIsAdmin(!!data.isAdmin);
      } catch (e) {
        console.error("Failed to check tournament status:", e);
      }

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

        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        if (hasAttempts) {
          resetGameStateAndStart("tournament");
          return;
        }

        const weekKey = getWeekKeyUTC();
        const pendingKey = `farbase:pendingTournament:${currentAddress.toLowerCase()}:${weekKey}`;

        // resume
        try {
          const raw = localStorage.getItem(pendingKey);
          if (raw) {
            const pending = JSON.parse(raw) as PendingPurchase;
            const isFresh = pending?.createdAt && Date.now() - pending.createdAt < 24 * 60 * 60 * 1000;

            if (isFresh && pending?.stage === "paid" && pending?.purchaseId) {
              const ok = await tryCreateEntryWithRetry(currentAddress, pending.purchaseId);
              if (ok) {
                localStorage.removeItem(pendingKey);
                resetGameStateAndStart("tournament");
                return;
              }
              console.error("Resume failed: create-entry still not completed.");
              return;
            }

            localStorage.removeItem(pendingKey);
          }
        } catch {}

        const USDC_ADDRESS =
          process.env.NEXT_PUBLIC_USDC_ADDRESS ||
          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

        const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
        if (!CONTRACT_ADDRESS) {
          console.error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
          return;
        }

        const waitForTransaction = async (txHash: `0x${string}`) => {
          const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
          for (let i = 0; i < 60; i++) {
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

        // purchaseId + pending initiated
        const purchaseId = genPurchaseId();
        try {
          const pending: PendingPurchase = { createdAt: Date.now(), purchaseId, stage: "initiated" };
          localStorage.setItem(pendingKey, JSON.stringify(pending));
        } catch {}

        let paid = false;
        const p = provider as any;

        // batch
        try {
          const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";

          const batchParams: any = {
            version: "2.0.0",
            from: currentAddress as `0x${string}`,
            chainId: "0x2105",
            calls: [
              { to: USDC_ADDRESS as `0x${string}`, data: approveData as `0x${string}`, value: "0x0" },
              { to: CONTRACT_ADDRESS as `0x${string}`, data: enterData as `0x${string}`, value: "0x0" },
            ],
          };

          if (paymasterUrl) {
            batchParams.capabilities = {
              paymasterService: { url: paymasterUrl },
            };
          }

          const batchId = (await p.request({
            method: "wallet_sendCalls",
            params: [batchParams],
          })) as string;

          let confirmed = false;
          for (let i = 0; i < 60; i++) {
            try {
              const status = (await p.request({
                method: "wallet_getCallsStatus",
                params: [batchId],
              })) as any;

              if (status?.status === 200) {
                confirmed = true;
                break;
              }
              if (status?.status && status.status !== 100) {
                throw new Error(`Batch failed: ${status.status}`);
              }
            } catch {
              confirmed = true;
              break;
            }

            await sleep(1500);
          }

          if (!confirmed) throw new Error("Batch confirmation timeout");

          paid = true;
          try {
            const pending: PendingPurchase = { createdAt: Date.now(), purchaseId, stage: "paid", method: "batch" };
            localStorage.setItem(pendingKey, JSON.stringify(pending));
          } catch {}
        } catch {
          // fallback approve + enter
          try {
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
            await waitForTransaction(approveTx);

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
            await waitForTransaction(entryTx);

            paid = true;
            try {
              const pending: PendingPurchase = { createdAt: Date.now(), purchaseId, stage: "paid", method: "fallback" };
              localStorage.setItem(pendingKey, JSON.stringify(pending));
            } catch {}
          } catch (e2) {
            try {
              const raw = localStorage.getItem(pendingKey);
              if (raw) {
                const pending = JSON.parse(raw) as PendingPurchase;
                if (pending?.stage !== "paid") localStorage.removeItem(pendingKey);
              }
            } catch {}
            console.error("Tournament payment failed:", e2);
            return;
          }
        }

        if (!paid) {
          console.error("Payment not completed.");
          return;
        }

        const entryOk = await tryCreateEntryWithRetry(currentAddress, purchaseId);

        if (!entryOk) {
          console.error("Payment succeeded but entry registration failed. Pending preserved for resume.");
          return;
        }

        localStorage.removeItem(pendingKey);
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
            if (fid === null) return;
            setScreen("leaderboard");
          }}
          onAdmin={isAdmin && fid !== null ? () => setScreen("admin") : undefined}
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
                <Scoreboard
                  score={score}
                  highestLevel={highestLevel}
                  mergeCount={mergeCount}
                  platform={platform}
                />
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
              platform={platform}
            />
          )}
        </div>
      )}
    </div>
  );
}
