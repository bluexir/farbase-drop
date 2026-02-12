"use client";

interface HowToPlayProps {
  onClose: () => void;
}

const rules = [
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
    title: "Practice Mode",
    text: "Free daily attempts. No rewards. Perfect for warming up and testing strategies.",
  },
  {
    icon: "🏆",
    title: "Tournament Mode",
    text: "Pay 1 USDC to enter. Each entry gives 3 attempts. Top 5 scores win the weekly prize pool.",
  },
  {
    icon: "⚠️",
    title: "Fair Play",
    text: "Scores are validated server-side. Cheating or tampering will invalidate your score.",
  },
];

export default function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "18px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background:
            "radial-gradient(circle at top, rgba(124,58,237,0.20), rgba(0,0,0,0.95))",
          borderRadius: "18px",
          border: "1px solid rgba(255,255,255,0.12)",
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
              color: "#fff",
              fontSize: "1.1rem",
              fontWeight: 900,
            }}
          >
            How to Play
          </h2>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
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
          {rules.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "1.3rem", lineHeight: 1 }}>{r.icon}</div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: "0.9rem",
                    marginBottom: "2px",
                  }}
                >
                  {r.title}
                </div>
                <div style={{ color: "#aaa", fontSize: "0.78rem" }}>
                  {r.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "14px", color: "#777", fontSize: "0.72rem" }}>
          Tip: Focus on building space and planning merges — rushing fills the
          container fast.
        </div>
      </div>
    </div>
  );
}
