import { Redis } from "@upstash/redis";
import { requireQuickAuthUser, isInvalidTokenError } from "@/lib/quick-auth-server";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ── Types ──────────────────────────────────────────────

export interface SupportedToken {
  address: string;
  symbol: string;
  decimals: number;
  active: boolean;
}

export interface SponsorCoin {
  name: string;
  symbol: string;
  iconUrl: string;
  color: string;
  glowColor: string;
}

export interface AdminSettings {
  entryFeeRaw: number;        // raw units (e.g. 1000000 = 1 USDC)
  tournamentActive: boolean;
  payoutDistribution: number[]; // e.g. [40, 25, 15, 10, 10]
  supportedTokens: SupportedToken[];
  sponsorCoin: SponsorCoin;
  announcements: string[];
}

export interface PromotedApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  url: string;
  order: number;
}

// ── Defaults ───────────────────────────────────────────

const DEFAULT_SETTINGS: AdminSettings = {
  entryFeeRaw: 1_000_000,
  tournamentActive: true,
  payoutDistribution: [40, 25, 15, 10, 10],
  supportedTokens: [
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
      active: true,
    },
  ],
  sponsorCoin: {
    name: "Sponsor",
    symbol: "SPONSOR",
    iconUrl: "",
    color: "#FF6B6B",
    glowColor: "#FF6B6B88",
  },
  announcements: [],
};

const SETTINGS_KEY = "admin:settings";
const APPS_KEY = "admin:promoted-apps";

// ── Auth ───────────────────────────────────────────────

export function getAdminFid(): number {
  return Number(process.env.ADMIN_FID || "0");
}

export function isAdmin(fid: number): boolean {
  const adminFid = getAdminFid();
  return adminFid > 0 && fid === adminFid;
}

export async function requireAdmin(request: Request): Promise<number> {
  const user = await requireQuickAuthUser(request);
  if (!isAdmin(user.fid)) {
    throw new Error("Forbidden: not admin");
  }
  return user.fid;
}

// ── Settings CRUD ──────────────────────────────────────

export async function getSettings(): Promise<AdminSettings> {
  const raw = await redis.get<AdminSettings>(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...raw };
}

export async function updateSettings(
  partial: Partial<AdminSettings>
): Promise<AdminSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await redis.set(SETTINGS_KEY, updated);
  return updated;
}

// ── Promoted Apps CRUD ─────────────────────────────────

export async function getPromotedApps(): Promise<PromotedApp[]> {
  const raw = await redis.get<PromotedApp[]>(APPS_KEY);
  if (!raw || !Array.isArray(raw)) return [];
  return raw.sort((a, b) => a.order - b.order);
}

export async function setPromotedApps(apps: PromotedApp[]): Promise<void> {
  await redis.set(APPS_KEY, apps);
}
