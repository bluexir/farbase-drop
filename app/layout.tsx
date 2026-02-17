import type { Metadata } from "next";
import "./globals.css";

const miniAppEmbed = {
  version: "1",
  imageUrl: "https://farbase-drop.vercel.app/image.png",
  button: {
    title: "🪙 FarBase Drop",
    action: {
      type: "launch_frame",
      name: "FarBase Drop",
      url: "https://farbase-drop.vercel.app",
      splashBackgroundColor: "#0a0a1a",
    },
  },
};

export const metadata: Metadata = {
  title: "FarBase Drop",
  description: "Skill-Based Crypto Merge on Base",
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="6993b3bb7ca07f5750bbdc2b" />
      </head>
      <body>{children}</body>
    </html>
  );
}
