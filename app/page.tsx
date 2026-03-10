"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Attribution } from "ox/erc8021";
import GameCanvas from "@/components/GameCanvas";
import Scoreboard from "@/components/Scoreboard";
import GameOver from "@/components/GameOver";
import MainMenu from "@/components/MainMenu";
import Leaderboard from "@/components/Leaderboard";
import AdminPanel from "@/components/AdminPanel";
import ChallengeList from "@/components/ChallengeList";
import NewChallengePopup from "@/components/NewChallengePopup";
import ChallengeResult from "@/components/ChallengeResult";
import { getCoinByLevel, Platform } from "@/lib/coins";
import { GameLog, calculateScoreFromLog } from "@/lib/game-log";
import { Lang, t } from "@/lib/i18n";

export type Theme = "light" | "dark";

type Screen = "menu" | "practice" | "tournament" | "leaderboard" | "admin" | "challenges" | "challenge-game";

type AttemptsResponse = {
  mode: "practice" | "tournament";
  remaining: number | null;
  limit: number | null;
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

type Challenge = {
  id: string;
  creatorFid: number;
  creatorUsername: string;
  creatorScore: number | null;
  targetFid: number | null;
  targetUsername: string | null;
  targetScore: number | null;
  type: "open" | "direct";
  status: "pending" | "accepted" | "completed" | "expired";
  winner: "creator" | "target" | "tie" | null;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
};

type PendingChallengeData = {
  type: "open" | "direct";
  targetUsername: string | null;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  if (context?.client?.clientFid === 309857) {
    return "base";
  }
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
  const [username, setUsername] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [platform, setPlatform] = useState<Platform>("farcaster");
  const [theme, setTheme] = useState<Theme>("dark");
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("farbase_lang");
      if (saved === "en" || saved === "tr") {
        setLang(saved);
        return;
      }
    } catch (_e) {}

    const nav = typeof navigator !== "undefined" ? navigator.language : "en";
    setLang(nav.toLowerCase().startsWith("tr") ? "tr" : "en");
  }, []);

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

  // Challenge states
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [pendingChallengeData, setPendingChallengeData] = useState<PendingChallengeData | null>(null);
  const [challengeCount, setChallengeCount] = useState<number>(0);
  const [showNewChallengePopup, setShowNewChallengePopup] = useState(false);
  const [newChallengeTargetUsername, setNewChallengeTargetUsername] = useState<string | null>(null);
  const [showChallengeResult, setShowChallengeResult] = useState(false);
  const [completedChallenge, setCompletedChallenge] = useState<Challenge | null>(null);

  // Challenge URL parametresi kontrolü
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get("challenge");
    if (challengeId && fid) {
      fetchAndAcceptChallenge(challengeId);
    }
  }, [fid]);

  const fetchChallengeCount = useCallback(async () => {
    if (!fid) {
      setChallengeCount(0);
      return;
    }
    try {
      const res = await sdk.quickAuth.fetch("/api/challenge/list?filter=incoming");
      if (res.ok) {
        const data = await res.json();
        setChallengeCount(data.challenges?.length || 0);
      }
    } catch (e) {
      console.error("Failed to fetch challenge count:", e);
    }
  }, [fid]);

  useEffect(() => {
    if (fid) {
      fetchChallengeCount();
    }
  }, [fid, fetchChallengeCount]);

  const fetchAndAcceptChallenge = async (challengeId: string) => {
    try {
      const res = await sdk.quickAuth.fetch(`/api/challenge?id=${challengeId}`);
      if (!res.ok) {
        console.error("Challenge not found");
        return;
      }
      const data = await res.json();
      const challenge = data.challenge as Challenge;

      if (challenge.status === "completed") {
        console.error("Challenge already completed");
        return;
      }
      if (challenge.status === "expired") {
        console.error("Challenge expired");
        return;
      }
      if (challenge.creatorFid === fid) {
        console.error("Cannot accept your own challenge");
        return;
      }
      if (challenge.type === "direct" && challenge.targetFid !== fid) {
        console.error("This challenge is not for you");
        return;
      }

      setActiveChallenge(challenge);
      startChallengeGame();

      const url = new URL(window.location.href);
      url.searchParams.delete("challenge");
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      console.error("Failed to fetch challenge:", e);
    }
  };

  const startChallengeGame = () => {
    setCurrentMode("practice");
    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);
    setScoreSaved(false);
    setScoreSaveError(null);
    setRemainingAttempts(null);
    setIsNewBest(false);
    setGameKey((k) => k + 1);
    setScreen("challenge-game");
  };

  useEffect(() => {
    async function init() {
      try {
        const context = await sdk.context;

        const maybeFid = context?.user?.fid;
        setFid(typeof maybeFid === "number" ? maybeFid : null);

        const maybeUsername = context?.user?.username;
        setUsername(typeof maybeUsername === "string" ? maybeUsername : null);

        setPlatform(detectPlatform(context));

        const notifDetails = context?.client?.notificationDetails;
        if (maybeFid && notifDetails?.url && notifDetails?.token) {
          try {
            await fetch("/api/webhook", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "notifications_enabled",
                fid: maybeFid,
                notificationDetails: {
                  url: notifDetails.url,
                  token: notifDetails.token,
                },
              }),
            });
          } catch {}
        }

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

      if (fid === null) {
        setScoreSaveError("Sign-in required to save score.");
        return;
      }

      // CREATOR: Yeni challenge oluşturuyor
      if (pendingChallengeData && screen === "challenge-game") {
        try {
          const res = await sdk.quickAuth.fetch("/api/challenge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: pendingChallengeData.type,
              targetUsername: pendingChallengeData.targetUsername,
              score: finalScore,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const challenge = data.challenge as Challenge;

            const baseAppUrl = "https://farbase-drop.vercel.app";
            const challengeUrl = `${baseAppUrl}?challenge=${challenge.id}`;
            const mention = platform === "base" ? "@bluexir.farcaster.eth" : "@bluexir";

            let castText = "";
            if (pendingChallengeData.type === "direct" && pendingChallengeData.targetUsername) {
              castText = `⚔️ @${pendingChallengeData.targetUsername}! I challenge you to beat my ${finalScore} points on FarBase Drop!\n\nBy ${mention}`;
            } else {
              castText = `⚔️ Who can beat my ${finalScore} points on FarBase Drop?\n\nBy ${mention}`;
            }

            await sdk.actions.composeCast({ text: castText, embeds: [challengeUrl] });
            
            setPendingChallengeData(null);
            setScreen("menu");
            fetchChallengeCount();
            return;
          } else {
            const errData = await res.json();
            setScoreSaveError(errData.error || "Failed to create challenge");
          }
        } catch (e) {
          console.error("Challenge creation error:", e);
          setScoreSaveError("Network error — challenge not created");
        }
        setPendingChallengeData(null);
        return;
      }

      // ACCEPTOR: Mevcut challenge'ı tamamlıyor
      if (activeChallenge && screen === "challenge-game") {
        try {
          const res = await sdk.quickAuth.fetch("/api/challenge", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challengeId: activeChallenge.id,
              score: finalScore,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            setCompletedChallenge(data.challenge);
            setShowChallengeResult(true);
            setScoreSaved(true);
          } else {
            const data = await res.json();
            setScoreSaveError(data.error || "Failed to complete challenge");
          }
        } catch (e) {
          console.error("Challenge completion error:", e);
          setScoreSaveError("Network error — challenge not completed");
        }
        return;
      }

      // Normal oyun - skor kaydet
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
    [fid, address, currentMode, screen, activeChallenge, pendingChallengeData, platform, fetchChallengeCount]
  );

  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel, platform);
      const miniappUrl = platform === "base"
        ? "https://base.app/app/farbase-drop.vercel.app"
        : "https://farcaster.xyz/miniapps/cho2c_l-CEGb/farbase-drop";

      const mention = platform === "base" ? "@bluexir.farcaster.eth" : "@bluexir";
      const text = `I just scored ${score} points on FarBase Drop! Highest coin: ${
        coinData?.symbol || "?"
      }\n\nBy ${mention}`;

      await sdk.actions.composeCast({ text, embeds: [miniappUrl] });
    } catch (e) {
      console.error("Cast error:", e);
    }
  }, [score, highestLevel, platform]);

  const handleChallengeFromGameOver = useCallback(() => {
    if (score > 0) {
      setNewChallengeTargetUsername(null);
      setShowNewChallengePopup(true);
    }
  }, [score]);

  const handleChallengeFromLeaderboard = useCallback((targetFid: number, targetUsername: string, targetScore: number) => {
    setNewChallengeTargetUsername(targetUsername);
    setShowNewChallengePopup(true);
  }, []);

  // Popup'tan çağrılır - Oyun başlatır
  const handleStartChallengeGame = useCallback((type: "open" | "direct", targetUsername: string | null) => {
    setPendingChallengeData({ type, targetUsername });
    setActiveChallenge(null);
    setShowNewChallengePopup(false);
    startChallengeGame();
  }, []);

  const handleChallengeResultShare = useCallback(async () => {
    if (!completedChallenge) return;

    try {
      const miniappUrl = platform === "base"
        ? "https://base.app/app/farbase-drop.vercel.app"
        : "https://farcaster.xyz/miniapps/cho2c_l-CEGb/farbase-drop";

      const mention = platform === "base" ? "@bluexir.farcaster.eth" : "@bluexir";

      const isCreator = completedChallenge.creatorFid === fid;
      const myScore = isCreator ? completedChallenge.creatorScore : completedChallenge.targetScore;
      const opponentScore = isCreator ? completedChallenge.targetScore : completedChallenge.creatorScore;
      const opponentUsername = isCreator ? completedChallenge.targetUsername : completedChallenge.creatorUsername;
      const won = completedChallenge.winner === (isCreator ? "creator" : "target");

      let castText = `⚔️ Challenge Result!\n`;
      if (completedChallenge.winner === "tie") {
        castText += `🤝 Tie with @${opponentUsername}!\n${myScore} vs ${opponentScore}\n`;
      } else if (won) {
        castText += `🏆 I beat @${opponentUsername}!\n${myScore} vs ${opponentScore}\n`;
      } else {
        castText += `😢 @${opponentUsername} beat me!\n${myScore} vs ${opponentScore}\n`;
      }
      castText += `\nBy ${mention}`;

      await sdk.actions.composeCast({ text: castText, embeds: [miniappUrl] });
    } catch (e) {
      console.error("Share result error:", e);
    }
  }, [completedChallenge, fid, platform]);

  const handleRematch = useCallback(async () => {
    if (!completedChallenge) return;

    const isCreator = completedChallenge.creatorFid === fid;
    const opponentUsername = isCreator ? completedChallenge.targetUsername : completedChallenge.creatorUsername;

    if (opponentUsername) {
      setNewChallengeTargetUsername(opponentUsername);
      setShowChallengeResult(false);
      setCompletedChallenge(null);
      setActiveChallenge(null);
      setShowNewChallengePopup(true);
    }
  }, [completedChallenge, fid]);

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
      setActiveChallenge(null);
      setPendingChallengeData(null);

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
        hasAttempts = typeof data.remaining === "number" && data.remaining > 0;
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

        const purchaseId = genPurchaseId();
        try {
          const pending: PendingPurchase = { createdAt: Date.now(), purchaseId, stage: "initiated" };
          localStorage.setItem(pendingKey, JSON.stringify(pending));
        } catch {}

        let paid = false;
        const p = provider as any;

        try {
          const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";
          const builderCodeSuffix = Attribution.toDataSuffix({ codes: ["bc_va80qhc4"] });

          const batchParams: any = {
            version: "2.0.0",
            from: currentAddress as `0x${string}`,
            chainId: "0x2105",
            calls: [
              { to: USDC_ADDRESS as `0x${string}`, data: approveData as `0x${string}`, value: "0x0" },
              { to: CONTRACT_ADDRESS as `0x${string}`, data: enterData as `0x${string}`, value: "0x0" },
            ],
          };

          batchParams.capabilities = {
            dataSuffix: { value: builderCodeSuffix },
          };

          if (paymasterUrl) {
            batchParams.capabilities.paymasterService = { url: paymasterUrl };
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
          color: theme === "dark" ? "#fff" : "#000",
          background: theme === "dark" ? "#000" : "#f5f5f5",
        }}
      >
        {t(lang, "common.loading")}
      </div>
    );
  }

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleLang = () => {
    setLang((prev) => {
      const next: Lang = prev === "en" ? "tr" : "en";
      try { localStorage.setItem("farbase_lang", next); } catch (_e) {}
      return next;
    });
  };

  // Challenge banner text
  const getChallengeBannerText = () => {
    if (pendingChallengeData) {
      if (pendingChallengeData.type === "direct" && pendingChallengeData.targetUsername) {
        return lang === "tr" 
          ? `⚔️ @${pendingChallengeData.targetUsername}'a meydan okuyorsun!`
          : `⚔️ Challenging @${pendingChallengeData.targetUsername}!`;
      }
      return lang === "tr" ? "⚔️ Açık meydan okuma!" : "⚔️ Open Challenge!";
    }
    if (activeChallenge) {
      if (activeChallenge.creatorScore) {
        return `⚔️ Beat @${activeChallenge.creatorUsername}'s ${activeChallenge.creatorScore} pts!`;
      }
      return `⚔️ Challenge from @${activeChallenge.creatorUsername}`;
    }
    return "";
  };

  return (
    <div style={{ minHeight: "100vh", background: theme === "dark" ? "#000" : "#f5f5f5", position: "relative" }}>
      {screen === "menu" && (
        <MainMenu
          fid={fid}
          theme={theme}
          platform={platform}
          lang={lang}
          onToggleLang={toggleLang}
          onToggleTheme={toggleTheme}
          onPractice={() => startGame("practice")}
          onTournament={() => startGame("tournament")}
          onLeaderboard={() => {
            if (fid === null) return;
            setScreen("leaderboard");
          }}
          onChallenge={fid !== null ? () => setScreen("challenges") : undefined}
          challengeCount={challengeCount}
          onAdmin={fid !== null ? () => setScreen("admin") : undefined}
        />
      )}

      {screen === "leaderboard" && fid !== null && (
        <Leaderboard
          fid={fid}
          theme={theme}
          lang={lang}
          onBack={() => setScreen("menu")}
          onChallenge={handleChallengeFromLeaderboard}
        />
      )}

      {screen === "challenges" && fid !== null && (
        <ChallengeList
          fid={fid}
          theme={theme}
          lang={lang}
          platform={platform}
          onBack={() => {
            setScreen("menu");
            fetchChallengeCount();
          }}
          onNewChallenge={() => {
            setNewChallengeTargetUsername(null);
            setShowNewChallengePopup(true);
          }}
          onAcceptChallenge={(challenge: Challenge) => {
            setActiveChallenge(challenge);
            setPendingChallengeData(null);
            startChallengeGame();
          }}
          onRematch={(opponentUsername: string) => {
            setNewChallengeTargetUsername(opponentUsername);
            setShowNewChallengePopup(true);
          }}
        />
      )}

      {screen === "admin" && <AdminPanel onBack={() => setScreen("menu")} />}

      {(screen === "practice" || screen === "tournament" || screen === "challenge-game") && (
        <div
          style={{
            height: "100vh",
            overflow: "hidden",
            background: theme === "dark" 
              ? "radial-gradient(circle at center, #0a0a1a 0%, #000 100%)"
              : "radial-gradient(circle at center, #ffffff 0%, #f5f5f5 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Challenge Banner */}
          {screen === "challenge-game" && (activeChallenge || pendingChallengeData) && !gameOver && (
            <div
              style={{
                width: "100%",
                maxWidth: 550,
                background: "linear-gradient(135deg, #f97316, #fb923c)",
                padding: "10px 16px",
                textAlign: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              {getChallengeBannerText()}
            </div>
          )}

          {!gameOver ? (
            <>
              <div style={{ flexShrink: 0, width: "100%", maxWidth: 550 }}>
                <Scoreboard
                  score={score}
                  highestLevel={highestLevel}
                  mergeCount={mergeCount}
                  lang={lang}
                  platform={platform}
                  theme={theme}
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
                  mode={screen === "challenge-game" ? "practice" : screen}
                  gameStarted={true}
                  fid={fid ?? 0}
                  sessionId={`${fid ?? 0}-${gameKey}`}
                  onMerge={handleMerge}
                  onGameOver={handleGameOver}
                  theme={theme}
                  platform={platform}
                />
              </div>
            </>
          ) : showChallengeResult && completedChallenge ? (
            <ChallengeResult
              challenge={completedChallenge}
              myFid={fid!}
              theme={theme}
              lang={lang}
              onShare={handleChallengeResultShare}
              onRematch={handleRematch}
              onMenu={() => {
                setShowChallengeResult(false);
                setCompletedChallenge(null);
                setActiveChallenge(null);
                setScreen("menu");
                fetchChallengeCount();
              }}
            />
          ) : (
            <GameOver
              score={score}
              lang={lang}
              highestLevel={highestLevel}
              mergeCount={mergeCount}
              scoreSaved={scoreSaved}
              scoreSaveError={scoreSaveError}
              mode={currentMode}
              remaining={remainingAttempts}
              isNewBest={isNewBest}
              onRestart={handleRestart}
              onMenu={() => {
                setActiveChallenge(null);
                setPendingChallengeData(null);
                setScreen("menu");
              }}
              onCast={handleCast}
              onChallenge={screen === "practice" ? handleChallengeFromGameOver : undefined}
              platform={platform}
              theme={theme}
            />
          )}
        </div>
      )}

      {/* New Challenge Popup */}
      {showNewChallengePopup && (
        <NewChallengePopup
          theme={theme}
          lang={lang}
          platform={platform}
          defaultTargetUsername={newChallengeTargetUsername}
          onClose={() => setShowNewChallengePopup(false)}
          onStartGame={handleStartChallengeGame}
        />
      )}
    </div>
  );
}
