"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function Home() {
  const [fid, setFid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const context = await sdk.context;
      setFid(context.user.fid);
      await sdk.actions.ready();
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold text-yellow-400">FarBase Drop</h1>
        <p className="text-gray-400 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold text-yellow-400">FarBase Drop</h1>
      <p className="text-gray-400 mt-4">Welcome, FID: {fid}</p>
    </div>
  );
}
