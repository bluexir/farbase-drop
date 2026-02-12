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

const APPS_KEY = "admin:apps";

const DEFAULT_APPS = [
  {
    id: "app-unfollow-cleaner",
    name: "Unfollow Cleaner",
    icon: "🧹",
    description:
      "Clean your Farcaster follows based on Neynar score. View who doesn't follow you back, sort by engagement, and unfollow in bulk.",
    url: "https://unfollow-cleaner.vercel.app",
    order: 0,
  },
];

async function getApps() {
  const a = await redis.get<any[]>(APPS_KEY);
  return a || DEFAULT_APPS;
}

export async function GET(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    if (!isAdmin(user.fid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apps = await getApps();
    return NextResponse.json({ apps }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin apps GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch apps" },
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
    const apps = Array.isArray(body?.apps) ? body.apps : null;

    if (!apps) {
      return NextResponse.json({ error: "Invalid apps payload" }, { status: 400 });
    }

    // normalize order
    const normalized = apps
      .map((a: any, idx: number) => ({
        id: String(a.id ?? `app-${idx}`),
        name: String(a.name ?? ""),
        icon: String(a.icon ?? "📱"),
        description: String(a.description ?? ""),
        url: String(a.url ?? ""),
        order: typeof a.order === "number" ? a.order : idx,
      }))
      .sort((a: any, b: any) => a.order - b.order);

    await redis.set(APPS_KEY, normalized);

    return NextResponse.json({ apps: normalized }, { status: 200 });
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin apps PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update apps" },
      { status: 500 }
    );
  }
}
