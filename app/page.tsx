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
import { Address, Hex, parseAddress, assertHex } from "@/lib/eth";

type Screen = "menu" | "practice" | "tournament" | "leaderboard";

export default function Home() {
  const [fid, setFid] = useState<number | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);

  const [screen, setScreen] = useState<Screen>("menu");
  const [gameOver, setGameOver] = useState(false);

  const [score, setScore] = useState(0);
  const [mergeCount, setMergeCount] = useState(0);
  const [highestLevel, setHighestLevel] = useState(1);

  const [gameKey, setGameKey] = useState(0);

  const [currentMode, setCurrentMode] = useState<"practice" | "tournament">(
    "practice"
  );

  const [scoreSaved, setScoreSaved] = useState(false);

  // ✅ GameCanvas props için zorunlu alanlar
  const [sessionId, setSessionId] = useState<string>("");
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    async function init() {
      const context = await sdk.context;
      setFid(context.user.fid);

      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (provider) {
          const accounts = (await provider.request({
            method: "eth_accounts",
          })) as string[];
          if (accounts && accounts.length > 0) {
            setAddress(parseAddress(accounts[0]));
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

  const handleGameOver = useCallback(
    async (finalMerges: number, finalHighest: number, gameLog: GameLog) => {
      setGameOver(true);
      setGameStarted(false);

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
            sessionId, // ✅ artık state'ten geliyor
          }),
        });
        setScoreSaved(true);
      } catch (e) {
        console.error("Failed to save score:", e);
        alert("Score could not be saved. Please try again.");
      }
    },
    [fid, address, currentMode, sessionId]
  );

  const handleCast = useCallback(async () => {
    try {
      const coinData = getCoinByLevel(highestLevel);
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://farbase-drop.vercel.app";

      const text = `🪙 I just scored ${score} points on FarBase Drop! My highest coin reached: ${
        coinData?.symbol || "DOGE"
      } 🔥\n\nPlay now: ${appUrl}`;

      await sdk.actions.composeCast({
        text,
        embeds: [appUrl],
      });
    } catch (e) {
      console.error("Cast error:", e);
    }
  }, [score, highestLevel]);

  const startGame = useCallback(
    async (mode: "practice" | "tournament") => {
      // fid olmadan oyun başlatma
      if (!fid) {
        alert("Farcaster context not ready. Please try again.");
        return;
      }

      if (mode === "tournament") {
        let currentAddress: Address | null = address;

        if (!currentAddress) {
          try {
            const provider = await sdk.wallet.getEthereumProvider();
            if (provider) {
              const accounts = (await provider.request({
                method: "eth_accounts",
              })) as string[];
              if (accounts && accounts.length > 0) {
                const parsed = parseAddress(accounts[0]);
                if (!parsed) {
                  alert("Invalid wallet address");
                  return;
                }
                setAddress(parsed);
                currentAddress = parsed;
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

        if (!currentAddress) {
          alert("Wallet not connected");
          return;
        }

        try {
          const provider = await sdk.wallet.getEthereumProvider();
          if (!provider) throw new Error("No provider");

          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }], // Base Mainnet
          });

          const USDC_ADDRESS = parseAddress(
            process.env.NEXT_PUBLIC_USDC_ADDRESS ??
              "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
          );
          const CONTRACT_ADDRESS = parseAddress(
            process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
          );

          if (!USDC_ADDRESS) throw new Error("Invalid USDC address");
          if (!CONTRACT_ADDRESS)
            throw new Error(
              "Invalid contract address (NEXT_PUBLIC_CONTRACT_ADDRESS)"
            );

          const waitForTransaction = async (txHash: Hex) => {
            let confirmed = false;
            let attempts = 0;

            while (!confirmed && attempts < 30) {
              try {
                const receipt = (await provider.request({
                  method: "eth_getTransactionReceipt",
                  params: [txHash],
                })) as any;

                if (receipt && receipt.status === "0x1") {
                  confirmed = true;
                } else if (receipt && receipt.status === "0x0") {
                  throw new Error("Transaction failed");
                } else {
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  attempts++;
                }
              } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                attempts++;
              }
            }

            if (!confirmed) throw new Error("Transaction confirmation timeout");
          };

          const { ethers } = await import("ethers");

          // 1) Approve 1 USDC
          const usdcInterface = new ethers.Interface([
            "function approve(address spender, uint256 amount)",
          ]);
          const approveData = assertHex(
            usdcInterface.encodeFunctionData("approve", [
              CONTRACT_ADDRESS,
              1000000, // 1 USDC (6 decimals)
            ])
          );

          const approveTxHash = assertHex(
            await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  from: currentAddress,
                  to: USDC_ADDRESS,
                  data: approveData,
                },
              ],
            })
          );

          await waitForTransaction(approveTxHash);

          // 2) Enter tournament
          const contractInterface = new ethers.Interface([
            "function enterTournament(address token)",
          ]);
          const enterData = assertHex(
            contractInterface.encodeFunctionData("enterTournament", [
              USDC_ADDRESS,
            ])
          );

          const entryTxHash = assertHex(
            await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  from: currentAddress,
                  to: CONTRACT_ADDRESS,
                  data: enterData,
                },
              ],
            })
          );

          await waitForTransaction(entryTxHash);

          // entry kaydı (şimdilik)
          await fetch("/api/create-entry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fid,
              address: currentAddress,
              mode: "tournament",
            }),
          });
        } catch (e: any) {
          console.error("Tournament entry failed:", e);
          const errorMessage = e?.message || "Transaction failed";
          alert(`Tournament entry failed: ${errorMessage}`);
          return;
        }
      } else {
        // practice entry (şimdilik)
        try {
          await fetch("/api/create-entry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fid, address, mode: "practice" }),
          });
        } catch (e) {
          console.error("Practice entry failed:", e);
          alert("Failed to start practice mode");
          return;
        }
      }

      // ✅ yeni oyun başlangıcı
      setGameOver(false);
      setScore(0);
      setMergeCount(0);
      setHighestLevel(1);

      setCurrentMode(mode);
      setScreen(mode);

      setSessionId(`${fid}-${Date.now()}`);
      setGameStarted(true);

      setGameKey((prev) => prev + 1);
    },
    [address, fid]
  );

  const restartGame = useCallback(() => {
    if (!fid) return;

    setGameOver(false);
    setScore(0);
    setMergeCount(0);
    setHighestLevel(1);

    setSessionId(`${fid}-${Date.now()}`);
    setGameStarted(true);

    setGameKey((prev) => prev + 1);
  }, [fid]);

  const liveScore =
    (getCoinByLevel(highestLevel)?.scoreValue || 1) * mergeCount;

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
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-black text-white">
      {!gameOver ? (
        <>
          <Scoreboard
            score={liveScore}
            highestLevel={highestLevel}
            mergeCount={mergeCount}
          />
          <GameCanvas
            key={gameKey}
            mode={currentMode}
            gameStarted={gameStarted}
            fid={fid!}
            sessionId={sessionId}
            onMerge={handleMerge}
            onGameOver={handleGameOver}
          />
        </>
      ) : (
        <GameOver
          score={score}
          merges={mergeCount}
          highestLevel={highestLevel}
          scoreSaved={scoreSaved}
          mode={currentMode}
          onRestart={restartGame}
          onMenu={() => {
            setScreen("menu");
            setGameStarted(false);
          }}
          onCast={handleCast}
        />
      )}
    </div>
  );
}
