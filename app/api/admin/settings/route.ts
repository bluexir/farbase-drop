import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  requireQuickAuthUser,
  isInvalidTokenError,
} from "@/lib/quick-auth-server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SETTINGS_KEY = "admin:settings";

const DEFAULT_SETTINGS = {
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

async function getSettings() {
  const s = await redis.get<any>(SETTINGS_KEY);
  return s || DEFAULT_SETTINGS;
}

export async function GET(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    if (!isAdmin(user.fid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await getSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    if (!isAdmin(user.fid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const current = await getSettings();
    const next = { ...current, ...body };

    await redis.set(SETTINGS_KEY, next);

    return NextResponse.json({ settings: next }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update admin settings" },
      { status: 500 }
    );
  }
}
