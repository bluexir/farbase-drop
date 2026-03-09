"use client";

import { useState } from "react";
import type { Theme } from "@/app/page";
import { Lang, t } from "@/lib/i18n";
import { Platform } from "@/lib/coins";

interface NewChallengePopupProps {
  theme: Theme;
  lang: Lang;
  platform: Platform;
  currentScore: number | null;
  defaultTargetUsername: string | null;
  onClose: () => void;
  onCreate: (type: "open" | "direct", targetUsername: string | null, useCurrentScore: boolean) => void;
}

export default function NewChallengePopup({
  theme,
  lang,
  platform,
  currentScore,
  defaultTargetUsername,
  onClose,
  onCreate,
}: NewChallengePopupProps) {
  const [challengeType, setChallengeType] = useState<"open" | "direct">(
    defaultTargetUsername ? "direct" : "open"
  );
  const [targetUsername, setTargetUsername] = useState(defaultTargetUsername || "");
  const [useScore, setUseScore] = useState(currentScore !== null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDark = theme === "dark";

  const handleCreate = async () => {
    if (challengeType === "direct" && !targetUsername.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(
        challengeType,
        challengeType === "direct" ? targetUsername.trim() : null,
        useScore && currentScore !== null
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          background: isDark
            ? "radial-gradient(circle at top, rgba(249,115,22,0.15), rgba(0,0,0,0.98))"
            : "radial-gradient(circle at top, rgba(249,115,22,0.08), rgba(255,255,255,0.98))",
          borderRadius: "20px",
          border: isDark ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(249,115,22,0.2)",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 900,
              color: "#f97316",
            }}
          >
            ⚔️ {t(lang, "challenge.createChallenge")}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              border: "none",
              borderRadius: "8px",
              padding: "6px 10px",
              color: isDark ? "#fff" : "#1a1a1a",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t(lang, "common.close")}
          </button>
        </div>

        {/* Challenge Type */}
        <div style={{ marginBottom: "18px" }}>
          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: isDark ? "#fff" : "#1a1a1a",
            }}
          >
            {t(lang, "challenge.challengeType")}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setChallengeType("open")}
              style={{
                flex: 1,
                background: challengeType === "open"
                  ? "linear-gradient(135deg, #f97316, #fb923c)"
                  : isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.03)",
                border: challengeType === "open"
                  ? "none"
                  : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                borderRadius: "10px",
                padding: "12px 10px",
                color: challengeType === "open" ? "#fff" : isDark ? "#888" : "#666",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              🌐 {lang === "tr" ? "Açık" : "Open"}
            </button>
            <button
              onClick={() => setChallengeType("direct")}
              style={{
                flex: 1,
                background: challengeType === "direct"
                  ? "linear-gradient(135deg, #f97316, #fb923c)"
                  : isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.03)",
                border: challengeType === "direct"
                  ? "none"
                  : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                borderRadius: "10px",
                padding: "12px 10px",
                color: challengeType === "direct" ? "#fff" : isDark ? "#888" : "#666",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              🎯 {lang === "tr" ? "Direkt" : "Direct"}
            </button>
          </div>
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "0.7rem",
              color: isDark ? "#666" : "#888",
            }}
          >
            {challengeType === "open"
              ? t(lang, "challenge.openChallenge")
              : t(lang, "challenge.directChallenge")}
          </p>
        </div>

        {/* Target Username (only for direct) */}
        {challengeType === "direct" && (
          <div style={{ marginBottom: "18px" }}>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: isDark ? "#fff" : "#1a1a1a",
              }}
            >
              {t(lang, "challenge.challengeWho")}
            </p>
            <input
              type="text"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder={t(lang, "challenge.enterUsername")}
              style={{
                width: "100%",
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
                borderRadius: "10px",
                padding: "12px 14px",
                color: isDark ? "#fff" : "#1a1a1a",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Score Option */}
        {currentScore !== null && (
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: isDark ? "#fff" : "#1a1a1a",
              }}
            >
              {t(lang, "challenge.yourScore")}
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setUseScore(true)}
                style={{
                  flex: 1,
                  background: useScore
                    ? "linear-gradient(135deg, #22c55e, #4ade80)"
                    : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  border: useScore
                    ? "none"
                    : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  borderRadius: "10px",
                  padding: "12px 10px",
                  color: useScore ? "#fff" : isDark ? "#888" : "#666",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {currentScore} pts
              </button>
              <button
                onClick={() => setUseScore(false)}
                style={{
                  flex: 1,
                  background: !useScore
                    ? "linear-gradient(135deg, #3b82f6, #60a5fa)"
                    : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  border: !useScore
                    ? "none"
                    : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  borderRadius: "10px",
                  padding: "12px 10px",
                  color: !useScore ? "#fff" : isDark ? "#888" : "#666",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {t(lang, "challenge.noScore")}
              </button>
            </div>
          </div>
        )}

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={isSubmitting || (challengeType === "direct" && !targetUsername.trim())}
          style={{
            width: "100%",
            background:
              isSubmitting || (challengeType === "direct" && !targetUsername.trim())
                ? "#555"
                : "linear-gradient(135deg, #f97316, #fb923c)",
            border: "none",
            borderRadius: "12px",
            padding: "14px",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor:
              isSubmitting || (challengeType === "direct" && !targetUsername.trim())
                ? "not-allowed"
                : "pointer",
            marginBottom: "10px",
          }}
        >
          {isSubmitting ? "..." : `⚔️ ${t(lang, "challenge.create")}`}
        </button>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            background: "transparent",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
            borderRadius: "12px",
            padding: "14px",
            color: isDark ? "#888" : "#666",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {t(lang, "challenge.cancel")}
        </button>
      </div>
    </div>
  );
}
