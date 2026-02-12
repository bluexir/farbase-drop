"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface AdminSettings {
  entryFeeRaw: number;
  tournamentActive: boolean;
  payoutDistribution: number[];
  supportedTokens: {
    address: string;
    symbol: string;
    decimals: number;
    active: boolean;
  }[];
  sponsorCoin: {
    name: string;
    symbol: string;
    iconUrl: string;
    color: string;
    glowColor: string;
  };
  announcements: string[];
}

interface PromotedApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  url: string;
  order: number;
}

interface PayoutPreview {
  pool: string;
  winners: {
    rank: number;
    fid: number;
    address: string;
    score: number;
    displayName: string;
    payout: string;
    percentage: number;
  }[];
}

interface AdminPanelProps {
  onBack: () => void;
}

async function adminFetch(url: string, init?: RequestInit) {
  const res = await sdk.quickAuth.fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data;
}

// ── Small UI helpers ────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "16px",
        padding: "14px",
        marginBottom: "14px",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: "0.9rem",
          marginBottom: "10px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div
      style={{
        color: "#aaa",
        fontSize: "0.72rem",
        fontWeight: 700,
        marginBottom: "6px",
      }}
    >
      {text}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type || "text"}
      style={{
        width: "100%",
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "10px",
        padding: "10px 12px",
        color: "#fff",
        fontSize: "0.85rem",
        outline: "none",
        marginBottom: "10px",
        boxSizing: "border-box",
      }}
    />
  );
}

function Btn({
  children,
  onClick,
  disabled,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: color || "#00f3ff",
        border: "none",
        borderRadius: "12px",
        padding: "12px 14px",
        color: color ? "#000" : "#000",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontSize: "0.85rem",
      }}
    >
      {children}
    </button>
  );
}

// ── Component ───────────────────────────────────────

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [payout, setPayout] = useState<PayoutPreview | null>(null);
  const [apps, setApps] = useState<PromotedApp[]>([]);
  const [payoutTriggering, setPayoutTriggering] = useState(false);

  // Inputs
  const [entryFeeInput, setEntryFeeInput] = useState("1");
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorSymbol, setSponsorSymbol] = useState("");
  const [sponsorColor, setSponsorColor] = useState("#FF6B6B");
  const [sponsorIcon, setSponsorIcon] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const [newAppName, setNewAppName] = useState("");
  const [newAppIcon, setNewAppIcon] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [newAppUrl, setNewAppUrl] = useState("");

  // ── Helpers ────────────────────────────────────────

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  }, []);

  // ── Load settings/payout/apps ──────────────────────

  useEffect(() => {
    async function load() {
      try {
        const data = await adminFetch("/api/admin/settings");
        setSettings(data.settings);
        setEntryFeeInput(
          String(((data.settings.entryFeeRaw || 0) / 1_000_000).toFixed(2))
        );

        // Sponsor coin
        const sc = data.settings.sponsorCoin;
        if (sc) {
          setSponsorName(sc.name || "");
          setSponsorSymbol(sc.symbol || "");
          setSponsorColor(sc.color || "#FF6B6B");
          setSponsorIcon(sc.iconUrl || "");
        }

        const payoutData = await adminFetch("/api/admin/payout");
        setPayout(payoutData.preview || null);

        const appsData = await adminFetch("/api/admin/apps");
        setApps(appsData.apps || []);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Save settings ─────────────────────────────────

  const saveSettings = useCallback(
    async (partial: Partial<AdminSettings>) => {
      setSaving(true);
      try {
        const data = await adminFetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
        });
        setSettings(data.settings);
        showSuccess("Settings saved");
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [showSuccess]
  );

  // ── Trigger payout ────────────────────────────────

  const triggerPayout = useCallback(async () => {
    if (!confirm("Are you sure you want to trigger payout NOW?")) return;
    setPayoutTriggering(true);
    try {
      const data = await adminFetch("/api/admin/payout", { method: "POST" });
      showSuccess(`Payout sent! TX: ${data.txHash?.slice(0, 12)}...`);
    } catch (e) {
      setError(String(e));
    } finally {
      setPayoutTriggering(false);
    }
  }, [showSuccess]);

  // ── Save apps ─────────────────────────────────────

  const saveApps = useCallback(
    async (updatedApps: PromotedApp[]) => {
      try {
        const data = await adminFetch("/api/admin/apps", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apps: updatedApps }),
        });
        setApps(data.apps || []);
        showSuccess("Apps updated");
      } catch (e) {
        setError(String(e));
      }
    },
    [showSuccess]
  );

  const addApp = useCallback(() => {
    if (!newAppName || !newAppUrl) return;
    const newApp: PromotedApp = {
      id: `app-${Date.now()}`,
      name: newAppName,
      icon: newAppIcon || "📱",
      description: newAppDesc,
      url: newAppUrl,
      order: apps.length,
    };
    const updated = [...apps, newApp];
    setApps(updated);
    saveApps(updated);
    setNewAppName("");
    setNewAppIcon("");
    setNewAppDesc("");
    setNewAppUrl("");
  }, [apps, newAppName, newAppIcon, newAppDesc, newAppUrl, saveApps]);

  const removeApp = useCallback(
    (id: string) => {
      const updated = apps.filter((a) => a.id !== id);
      setApps(updated);
      saveApps(updated);
    },
    [apps, saveApps]
  );

  // ── Render ────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#555",
        }}
      >
        Loading admin panel...
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        overflowY: "auto",
        background:
          "radial-gradient(circle at center, #0a0a1a 0%, #000 100%)",
        padding: "24px 16px",
        paddingBottom: "60px",
        color: "#fff",
      }}
    >
      <div
        style={{
          maxWidth: "400px",
          margin: "0 auto",
        }}
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
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#00f3ff",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>
            ⚙️ Admin Panel
          </span>
          <div style={{ width: "60px" }} />
        </div>

        {/* Success / Error messages */}
        {successMsg && (
          <div
            style={{
              background: "rgba(0,200,100,0.15)",
              border: "1px solid #00c864",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "16px",
              color: "#00c864",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            ✓ {successMsg}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid #ef4444",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "16px",
              color: "#ef4444",
              fontSize: "0.8rem",
            }}
          >
            ⚠ {error}
            <button
              onClick={() => setError(null)}
              style={{
                float: "right",
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Tournament Status */}
        <Section title="🏆 Tournament Status">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "0.85rem" }}>
              Tournament{" "}
              <span
                style={{
                  color: settings?.tournamentActive ? "#00c864" : "#ef4444",
                  fontWeight: 700,
                }}
              >
                {settings?.tournamentActive ? "ACTIVE" : "PAUSED"}
              </span>
            </span>
            <button
              onClick={() =>
                saveSettings({
                  tournamentActive: !settings?.tournamentActive,
                })
              }
              disabled={saving}
              style={{
                background: settings?.tournamentActive ? "#ef4444" : "#00c864",
                border: "none",
                borderRadius: "8px",
                padding: "6px 14px",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {settings?.tournamentActive ? "Pause" : "Activate"}
            </button>
          </div>

          <div
            style={{
              background: "#0a0a0a",
              borderRadius: "10px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#888", fontSize: "0.7rem", margin: "0 0 4px" }}>
              Current Pool
            </p>
            <p
              style={{
                color: "#eab308",
                fontSize: "1.3rem",
                fontWeight: 800,
                margin: 0,
              }}
            >
              ${payout?.pool || "0"} USDC
            </p>
          </div>
        </Section>

        {/* 2. Entry Fee */}
        <Section title="💵 Entry Fee">
          <Label text="Entry fee (USDC)" />
          <div style={{ display: "flex", gap: "8px" }}>
            <Input
              value={entryFeeInput}
              onChange={setEntryFeeInput}
              type="number"
              placeholder="1"
            />
            <button
              onClick={() => {
                const raw = Math.round(parseFloat(entryFeeInput) * 1_000_000);
                if (raw > 0) saveSettings({ entryFeeRaw: raw });
              }}
              disabled={saving}
              style={{
                background: "#00f3ff",
                border: "none",
                borderRadius: "8px",
                padding: "0 16px",
                color: "#000",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Save
            </button>
          </div>
          <p style={{ color: "#555", fontSize: "0.65rem", margin: 0 }}>
            Current: {((settings?.entryFeeRaw || 0) / 1_000_000).toFixed(2)}{" "}
            USDC ({settings?.entryFeeRaw || 0} raw)
          </p>
        </Section>

        {/* 3. Payout Preview */}
        <Section title="💰 Payout Preview">
          {payout && payout.winners.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              {payout.winners.map((w) => (
                <div
                  key={w.rank}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#0a0a0a",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "0.8rem",
                  }}
                >
                  <span>
                    #{w.rank}{" "}
                    <span style={{ color: "#aaa" }}>{w.displayName}</span>
                  </span>
                  <span style={{ color: "#eab308", fontWeight: 700 }}>
                    ${w.payout} ({w.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p
              style={{
                color: "#555",
                fontSize: "0.8rem",
                marginBottom: "14px",
              }}
            >
              No winners yet this week
            </p>
          )}

          <Btn
            onClick={triggerPayout}
            disabled={payoutTriggering || !payout || payout.pool === "0"}
            color="#eab308"
          >
            {payoutTriggering ? "Processing..." : "🚀 Trigger Manual Payout"}
          </Btn>
          <p
            style={{
              color: "#555",
              fontSize: "0.6rem",
              marginTop: "8px",
              textAlign: "center",
            }}
          >
            This action cannot be rolled back once confirmed on-chain.
          </p>
        </Section>

        {/* 4. Sponsor Coin */}
        <Section title="🪙 Sponsor Coin (Level 3)">
          <Label text="Name" />
          <Input
            value={sponsorName}
            onChange={setSponsorName}
            placeholder="Sponsor"
          />
          <Label text="Symbol" />
          <Input
            value={sponsorSymbol}
            onChange={setSponsorSymbol}
            placeholder="SPONSOR"
          />
          <Label text="Color (hex)" />
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <Input
              value={sponsorColor}
              onChange={setSponsorColor}
              placeholder="#FF6B6B"
            />
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: sponsorColor || "#FF6B6B",
                flexShrink: 0,
                border: "1px solid #333",
              }}
            />
          </div>
          <Label text="Icon URL (optional)" />
          <Input
            value={sponsorIcon}
            onChange={setSponsorIcon}
            placeholder="https://..."
          />
          <Btn
            onClick={() =>
              saveSettings({
                sponsorCoin: {
                  name: sponsorName,
                  symbol: sponsorSymbol,
                  color: sponsorColor || "#FF6B6B",
                  glowColor: (sponsorColor || "#FF6B6B") + "88",
                  iconUrl: sponsorIcon,
                },
              })
            }
            disabled={saving}
          >
            Save Sponsor Coin
          </Btn>
        </Section>

        {/* 5. Promoted Apps */}
        <Section title="✨ Promoted Apps">
          {apps.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              {apps.map((app) => (
                <div
                  key={app.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#0a0a0a",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                      {app.icon} {app.name}
                    </span>
                    <p
                      style={{
                        color: "#555",
                        fontSize: "0.65rem",
                        margin: "2px 0 0",
                      }}
                    >
                      {app.url}
                    </p>
                  </div>
                  <button
                    onClick={() => removeApp(app.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "1rem",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              background: "#0a0a0a",
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <p
              style={{
                color: "#888",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginTop: 0,
                marginBottom: "10px",
              }}
            >
              Add New App
            </p>
            <Label text="Name" />
            <Input
              value={newAppName}
              onChange={setNewAppName}
              placeholder="My App"
            />
            <Label text="Icon (emoji)" />
            <Input
              value={newAppIcon}
              onChange={setNewAppIcon}
              placeholder="📱"
            />
            <Label text="Description" />
            <Input
              value={newAppDesc}
              onChange={setNewAppDesc}
              placeholder="Short description"
            />
            <Label text="URL" />
            <Input
              value={newAppUrl}
              onChange={setNewAppUrl}
              placeholder="https://..."
            />
            <Btn
              onClick={addApp}
              disabled={!newAppName || !newAppUrl}
              color="#7c3aed"
            >
              + Add App
            </Btn>
          </div>
        </Section>

        {/* 6. Announcements */}
        <Section title="📢 Announcements">
          {settings?.announcements && settings.announcements.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              {settings.announcements.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#0a0a0a",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "0.8rem",
                    color: "#ccc",
                  }}
                >
                  <span>{a}</span>
                  <button
                    onClick={() => {
                      const updated = settings.announcements.filter(
                        (_, idx) => idx !== i
                      );
                      saveSettings({ announcements: updated });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <Input
              value={announcement}
              onChange={setAnnouncement}
              placeholder="New announcement..."
            />
            <button
              onClick={() => {
                if (!announcement.trim()) return;
                const updated = [
                  ...(settings?.announcements || []),
                  announcement.trim(),
                ];
                saveSettings({ announcements: updated });
                setAnnouncement("");
              }}
              style={{
                background: "#00f3ff",
                border: "none",
                borderRadius: "8px",
                padding: "0 14px",
                color: "#000",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Add
            </button>
          </div>
        </Section>

        {/* Token Management */}
        <Section title="🔗 Supported Tokens">
          {settings?.supportedTokens.map((token, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0a0a0a",
                borderRadius: "8px",
                padding: "10px 12px",
                marginBottom: "6px",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <span style={{ fontWeight: 700 }}>{token.symbol}</span>
                <p
                  style={{
                    color: "#555",
                    fontSize: "0.6rem",
                    margin: "2px 0 0",
                    fontFamily: "monospace",
                  }}
                >
                  {token.address.slice(0, 8)}...{token.address.slice(-6)}
                </p>
              </div>
              <span
                style={{
                  color: token.active ? "#00c864" : "#ef4444",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                {token.active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
          <p
            style={{
              color: "#555",
              fontSize: "0.65rem",
              marginTop: "8px",
              textAlign: "center",
            }}
          >
            Token management requires contract redeployment.
            <br />
            Contact dev to add/remove tokens.
          </p>
        </Section>
      </div>
    </div>
  );
}
