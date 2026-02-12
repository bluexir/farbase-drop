"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";

type Mode = "practice" | "tournament";

type Entry = {
  fid: number;
  address: string;
  score: number;
  mergeCount: number;
  highestLevel: number;
  playedAt: number;
  displayName?: string;
  username?: string;
  pfpUrl?: string;
};

type ApiResponse = {
  data: Entry[];
  playerBest: Entry | null;
};

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

export default function Leaderboard({ fid }: { fid?: number }) {
  const [mode, setMode] = useState<Mode>("tournament");

  const { data, error, isLoading } = useSWR<ApiResponse>(
    fid ? `/api/leaderboard?mode=${mode}&fid=${fid}` : `/api/leaderboard?mode=${mode}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  const top5 = useMemo(() => data?.data ?? [], [data]);
  const playerBest = data?.playerBest ?? null;

  return (
    <div className="w-full max-w-xl mx-auto mt-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Leaderboard</h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("tournament")}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              mode === "tournament"
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Tournament
          </button>
          <button
            onClick={() => setMode("practice")}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              mode === "practice"
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Practice
          </button>
        </div>
      </div>

      {isLoading && (
        <p className="text-white/70 text-sm">Loading leaderboard...</p>
      )}

      {error && (
        <p className="text-red-400 text-sm">
          Failed to load leaderboard. Please try again.
        </p>
      )}

      {!isLoading && !error && (
        <>
          {top5.length === 0 ? (
            <p className="text-white/70 text-sm">No scores yet.</p>
          ) : (
            <ul className="space-y-2">
              {top5.map((e, idx) => (
                <li
                  key={`${e.fid}-${idx}`}
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 text-white/70 text-sm font-medium">
                      #{idx + 1}
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      {e.pfpUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.pfpUrl}
                          alt={e.displayName || e.username || `FID ${e.fid}`}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10" />
                      )}

                      <div className="min-w-0">
                        <div className="text-white text-sm font-medium truncate">
                          {e.displayName || e.username || `FID ${e.fid}`}
                        </div>
                        {e.username && (
                          <div className="text-white/60 text-xs truncate">
                            @{e.username}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">
                      {formatNumber(e.score)}
                    </div>
                    <div className="text-white/60 text-xs">
                      merges {formatNumber(e.mergeCount)} · lvl{" "}
                      {formatNumber(e.highestLevel)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {playerBest && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/70 text-xs mb-1">Your best</div>
              <div className="flex items-center justify-between">
                <div className="text-white text-sm font-medium">
                  {playerBest.displayName ||
                    playerBest.username ||
                    `FID ${playerBest.fid}`}
                </div>
                <div className="text-white font-semibold text-sm">
                  {formatNumber(playerBest.score)}
                </div>
              </div>
              <div className="text-white/60 text-xs mt-1">
                merges {formatNumber(playerBest.mergeCount)} · lvl{" "}
                {formatNumber(playerBest.highestLevel)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
