import type { Metadata } from "next";
import "./globals.css";

const miniAppEmbed = {
  version: "1",
  imageUrl: "https://farbase-drop.vercel.app/og.png",
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
  description: "Coinleri birleştir, skor yaz, ödül kazandır",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta name="fc:miniapp" content={JSON.stringify(miniAppEmbed)} />
        <meta name="fc:frame" content={JSON.stringify(miniAppEmbed)} />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          background: "#000",
          color: "#fff",
        }}
      >
        {children}
      </body>
    </html>
  );
}
