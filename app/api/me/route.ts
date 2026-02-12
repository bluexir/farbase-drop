export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sdk } from "@farcaster/miniapp-sdk";

export async function GET() {
  try {
    const context = await sdk.context;
    return NextResponse.json(
      {
        fid: context?.user?.fid || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("/api/me error:", error);
    return NextResponse.json({ fid: null }, { status: 200 });
  }
}
