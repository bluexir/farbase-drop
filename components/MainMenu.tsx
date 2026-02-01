"use client";

interface MainMenuProps {
  fid: number;
  onPractice: () => void;
  onTournament: () => void;
  onLeaderboard: () => void;
}

export default function MainMenu({ fid, onPractice, onTournament, onLeaderboard }: MainMenuProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        color: "#fff",
      }}
    >
      {/* Logo */}
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: "bold",
          color: "#00f3ff",
          textShadow: "0 0 20px #00f3ff, 0 0 40px #00f3ff44",
          marginBottom: "8px",
          textAlign: "center",
        }}
      >
        FarBase Drop
      </h1>

      {/* Subtitle */}
      <p
        style={{
          color: "#666",
          fontSize: "0.8rem",
          marginBottom: "40px",
          textAlign: "center",
          letterSpacing: "0.05em",
        }}
      >
        Skill-Based Crypto Merge • Base Mainnet
      </p>

      {/* Cards */}
      <div
        style={{
          width: "100%",
          maxWidth: "340px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Practice */}
        <div
          onClick={onPractice}
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            border: "1px solid #00f3ff",
            borderRadius: "16px",
            padding: "20px",
            cursor: "pointer",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px #00f3ff44";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "1rem", fontWeight: "bold", color: "#00f3ff" }}>
              🎮 Practice
            </span>
            <span
              style={{
                background: "#fff",
                color: "#000",
                fontSize: "0.7rem",
                fontWeight: "bold",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              3/3
            </span>
          </div>
          <p style={{ color: "#666", fontSize: "0.75rem", margin: 0 }}>
            Daily free attempts • Same seed • No rewards
          </p>
        </div>

        {/* Tournament */}
        <div
          onClick={onTournament}
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            border: "1px solid #ff00ff",
            borderRadius: "16px",
            padding: "20px",
            cursor: "pointer",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px #ff00ff44";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "1rem", fontWeight: "bold", color: "#ff00ff" }}>
              🏆 Tournament
            </span>
            <span
              style={{
                background: "#fff",
                color: "#000",
                fontSize: "0.7rem",
                fontWeight: "bold",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              3/3
            </span>
          </div>
          <p style={{ color: "#666", fontSize: "0.75rem", margin: 0 }}>
            1 USDC Entry • Top 5 Win • Daily 3 attempts
          </p>
        </div>

        {/* Leaderboard */}
        <div
          onClick={onLeaderboard}
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
            border: "1px solid #444",
            borderRadius: "16px",
            padding: "20px",
            cursor: "pointer",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px #44444444";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <span style={{ fontSize: "1rem", fontWeight: "bold", color: "#fff" }}>
              📊 Leaderboard
            </span>
          </div>
          <p style={{ color: "#666", fontSize: "0.75rem", margin: 0 }}>
            This week&apos;s rankings • Live updates
          </p>
        </div>
      </div>

      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <p style={{ fontFamily: "monospace", color: "#00f3ff", fontSize: "0.7rem", marginBottom: "4px" }}>
          Seed: 12345678
        </p>
        <p style={{ fontFamily: "monospace", color: "#444", fontSize: "0.65rem", margin: 0 }}>
          Contract: 0xadbd...30c8 • by @bluexir
        </p>
      </div>
