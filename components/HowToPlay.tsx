"use client";

import type { Theme } from "@/app/page";
import { Lang, t } from "@/lib/i18n";

interface HowToPlayProps {
  theme: Theme;
  lang: Lang;
  onClose: () => void;
}

// 6 kural - ikonlar sabit, başlık ve text i18n'den gelecek
const ruleKeys = [
  { icon: "🪙", titleKey: "howto.rule1Title", textKey: "howto.rule1Text" },
  { icon: "📈", titleKey: "howto.rule2Title", textKey: "howto.rule2Text" },
  { icon: "⚠️", titleKey: "howto.rule3Title", textKey: "howto.rule3Text" },
  { icon: "🆓", titleKey: "howto.rule4Title", textKey: "howto.rule4Text" },
  { icon: "🏆", titleKey: "howto.rule5Title", textKey: "howto.rule5Text" },
  { icon: "💰", titleKey: "howto.rule6Title", textKey: "howto.rule6Text" },
];

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
            {t(lang, "howto.title")}
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
            {t(lang, "common.close")}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {ruleKeys.map((rule, i) => (
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
              <div style={{ fontSize: "1.3rem", lineHeight: 1 }}>{rule.icon}</div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: isDark ? "#fff" : "#1a1a1a",
                    fontWeight: 900,
                    fontSize: "0.9rem",
                    marginBottom: "2px",
                  }}
                >
                  {t(lang, rule.titleKey)}
                </div>
                <div style={{ color: isDark ? "#aaa" : "#666", fontSize: "0.78rem" }}>
                  {t(lang, rule.textKey)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "14px", color: isDark ? "#777" : "#888", fontSize: "0.72rem" }}>
          {t(lang, "howto.tip")}
        </div>
      </div>
    </div>
  );
}
