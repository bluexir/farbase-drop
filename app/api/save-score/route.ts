"use client";

import React, { useEffect, useMemo, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import MainMenu from "@/components/MainMenu";
import Game from "@/components/Game";

type Mode = "practice" | "tournament";

export default function HomePage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [fid, setFid] = useState<number | null>(null);

  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [mode, setMode] = useState<Mode>("practice");

  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Mini App içinde mi? (Browser testlerinde patlamasın)
        const inMiniApp = await sdk.isInMiniApp();

        // Mini App değilse yine de UI açılsın (local/web test)
        if (!inMiniApp) {
          if (!cancelled) {
            setSdkReady(true);
            setFid(null);
          }
          return;
        }

        // Splash’ı kapatmak için gerekli
        await sdk.actions.ready();

        // Context
        const ctx = await sdk.context;

        if (!cancelled) {
          setSdkReady(true);
          setFid(ctx?.user?.fid ?? null);
        }
      } catch (e) {
        // SDK init sorununda en azından ekran gelsin
        if (!cancelled) {
          setSdkReady(true);
          setFid(null);
        }
        console.error("SDK init error:", e);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const canPlay = useMemo(() => sdkReady, [sdkReady]);

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[520px]">
        {screen === "menu" ? (
          <MainMenu
            sdkReady={sdkReady}
            fid={fid}
            onStart={(selectedMode, newSessionId) => {
              setMode(selectedMode);
              setSessionId(newSessionId);
              setScreen("game");
            }}
          />
        ) : (
          <Game
            sdkReady={sdkReady}
            fid={fid}
            sessionId={sessionId}
            mode={mode}
            canPlay={canPlay}
            onBackToMenu={() => setScreen("menu")}
          />
        )}
      </div>
    </main>
  );
}
