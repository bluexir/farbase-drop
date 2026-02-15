import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    accountAssociation: {
      header: "eyJmaWQiOjQyOTk3MywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweGI3YkEyNTk3NjI0MTRFMjRGOTI0MTVFRjc4MDE5Y2RjM2FlM0M5ZEUifQ",
      payload: "eyJkb21haW4iOiJmYXJiYXNlLWRyb3AudmVyY2VsLmFwcCJ9",
      signature: "J70IONSAdKfe4oVr0mM7gXt8ME2NdeQitjUYLUC/nJQQUI+/uKTCulvIB+X6pW0g8Soih42WnpwllMpdHCxHOBs=",
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
      subtitle: "Crypto Merge Game on Base",
      description: "Drop and merge crypto coins to score points. Practice free daily or enter weekly tournaments with USDC. Top 5 players win the prize pool. Built on Base mainnet.",
      primaryCategory: "games",
      tags: ["merge", "crypto", "game", "tournament", "base"],
      tagline: "Drop, Merge, Win, USDC",
      ogTitle: "FarBase Drop - Merge & Win",
      ogDescription: "Drop and merge crypto coins. Compete in weekly tournaments and win USDC prizes on Base.",
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
