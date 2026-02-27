"use client";

import type { Theme } from "@/app/page";
import { Lang, t } from "@/lib/i18n";

interface HowToPlayProps {
  theme: Theme;
  lang: Lang;
  onClose: () => void;
}

const rulesByLang: Record<Lang, { icon: string; title: string; text: string }[]> = {
  en: [
    {
      icon: "🪙",
      title: "Merge Coins",
      text: "Drop coins into the container. When two same-level coins touch, they merge into a higher-level coin.",
    },
    {
      icon: "📈",
      title: "Score Points",
      text: "Each merge earns points based on the new coin's level. Higher merges = more points. Total score determines rank.",
    },
    {
      icon: "🎮",
      title: "Play Modes",
      text: "Practice is free. Tournament costs 1 USDC per entry and gives 3 attempts. Top players win from the prize pool.",
    },
    {
      icon: "⚡",
      title: "Be Fast",
      text: "You have limited time. Plan your drops to avoid filling the container and aim for high-level merges.",
    },
  ],
  tr: [
    {
      icon: "🪙",
      title: "Coin Birleştir",
      text: "Coin'leri kaba bırak. Aynı seviyedeki iki coin temas edince daha yüksek seviyeye birleşir.",
    },
    {
      icon: "📈",
      title: "Puan Kazan",
      text: "Her birleşme, oluşan yeni coin seviyesine göre puan verir. Seviye yükseldikçe puan artar. Toplam puan sıralamayı belirler.",
    },
    {
      icon: "🎮",
      title: "Oyun Modları",
      text: "Pratik ücretsizdir. Turnuva giriş ücreti 1 USDC’dir ve giriş başına 3 deneme verir. En iyi oyuncular ödül havuzundan kazanır.",
    },
    {
      icon: "⚡",
      title: "Hızlı Ol",
      text: "Süren sınırlı. Kabı doldurmadan planlı bırak, yüksek seviye birleşmelere odaklan.",
    },
  ],
};

const rules = rulesByLang;

export default function HowToPlay({ theme, lang, onClose }: HowToPlayProps) {
  const isDark = theme === 'dark';
  
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "18px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          maxHeight: "85vh",
          overflowY: "auto",
          background: isDark
            ? "radial-gradient(circle at top, rgba(124,58,237,0.20), rgba(0,0,0,0.95))"
            : "radial-gradient(circle at top, rgba(124,58,237,0.10), rgba(255,255,255,0.98))",
          borderRadius: "18px",
          border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.1)",
          padding: "18px",
          boxSizing: "border-box",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: isDark ? "#fff" : "#1a1a1a",
              fontSize: "1.1rem",
              fontWeight: 900,
            }}
          >
            How to Play
          </h2>

          <button
            onClick={onClose}
            style={{
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.1)",
              color: isDark ? "#fff" : "#1a1a1a",
              borderRadius: "10px",
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: "0.8rem",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {rules[lang].map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                borderRadius: "14px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "1.3rem", lineHeight: 1 }}>{r.icon}</div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: isDark ? "#fff" : "#1a1a1a",
                    fontWeight: 900,
                    fontSize: "0.9rem",
                    marginBottom: "2px",
                  }}
                >
                  {r.title}
                </div>
                <div style={{ color: isDark ? "#aaa" : "#666", fontSize: "0.78rem" }}>
                  {r.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "14px", color: isDark ? "#777" : "#888", fontSize: "0.72rem" }}>
          Tip: Focus on building space and planning merges — rushing fills the
          container fast.
        </div>
      </div>
    </div>
  );
}
