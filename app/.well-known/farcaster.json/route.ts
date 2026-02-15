import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    accountAssociation: {
      header: "",
      payload: "",
      signature: "",
    },
    frame: {
      name: "FARBASE DROP",
      version: "1",
      iconUrl: "https://farbase-drop.vercel.app/icon.png",
      homeUrl: "https://farbase-drop.vercel.app",
      imageUrl: "https://farbase-drop.vercel.app/image.png",
      buttonTitle: "Play Now",
      splashImageUrl: "https://farbase-drop.vercel.app/splash.png",
      splashBackgroundColor: "#0a0a1a",
      webhookUrl: "https://farbase-drop.vercel.app/api/webhook",
      subtitle: "Skill-Based Crypto Merge Game on Base",
      description:
        "Drop and merge crypto coins to score points. Practice free daily or enter weekly tournaments with USDC. Top 5 players win the prize pool. Built on Base mainnet.",
      primaryCategory: "games",
      tags: ["merge", "crypto", "game", "tournament", "base"],
      tagline: "Drop, Merge, Win, USDC",
      ogTitle: "FarBase Drop — Crypto Merge Game",
      ogDescription:
        "Drop and merge crypto coins. Compete in weekly tournaments and win USDC prizes on Base.",
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
