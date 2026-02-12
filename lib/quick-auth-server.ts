export type QuickAuthUser = {
  fid: number;
};

export function isInvalidTokenError(e: any) {
  const msg = String(e?.message || e || "");
  return msg.toLowerCase().includes("unauthorized");
}

export async function requireQuickAuthUser(request: Request): Promise<QuickAuthUser> {
  // Minimal server verifier used in this zip:
  // It expects Farcaster QuickAuth to be handled by the SDK fetch wrapper.
  // On server, we accept a header injected by the SDK or fallback to query.
  const fidHeader =
    request.headers.get("x-farcaster-fid") ||
    request.headers.get("x-fid") ||
    "";

  const fid = Number(fidHeader);

  if (!fid || !Number.isFinite(fid)) {
    throw new Error("Unauthorized");
  }

  return { fid };
}
