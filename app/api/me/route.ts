import { NextResponse } from "next/server";
import {
  requireQuickAuthUser,
  isInvalidTokenError,
} from "@/lib/quick-auth-server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireQuickAuthUser(request);
    return NextResponse.json(
      {
        fid: user.fid,
        isAdmin: isAdmin(user.fid),
      },
      { status: 200 }
    );
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Error in /api/me:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
