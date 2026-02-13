import { Errors, createClient } from "@farcaster/quick-auth";

type VerifiedUser = {
  fid: number;
};

const client = createClient();

function parseFid(sub: unknown): number {
  let fid: number;

  if (typeof sub === "number") {
    fid = sub;
  } else if (typeof sub === "string") {
    fid = Number(sub);
  } else if (typeof sub === "bigint") {
    if (sub > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Errors.InvalidTokenError("Invalid fid");
    }
    fid = Number(sub);
  } else {
    throw new Errors.InvalidTokenError("Invalid token subject");
  }

  if (!Number.isFinite(fid) || !Number.isInteger(fid) || fid <= 0) {
    throw new Errors.InvalidTokenError("Invalid fid");
  }

  return fid;
}

function getVerifyDomain(request: Request): string {
  // 1) Env'den sabit domain (en güvenilir — Vercel proxy sorunlarını bypass eder)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_MINIAPP_URL;
  if (envUrl) {
    try {
      // "https://farbase-drop.vercel.app" → "farbase-drop.vercel.app"
      // "farbase-drop.vercel.app" → "farbase-drop.vercel.app"
      const parsed = envUrl.includes("://") ? new URL(envUrl).host : envUrl;
      if (parsed) return parsed;
   } catch (_e) {
      // geçersiz URL — fallback'e devam
    }
  }

  // 2) Request header'larından (Vercel x-forwarded-host genelde doğrudur)
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) return forwarded.split(",")[0].trim();

  const host = request.headers.get("host");
  if (host) return host;

  // 3) Son çare: URL'den
  return new URL(request.url).host;
}

export async function requireQuickAuthUser(request: Request): Promise<VerifiedUser> {
  const authorization =
    request.headers.get("authorization") || request.headers.get("Authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new Errors.InvalidTokenError("Missing token");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const domain = getVerifyDomain(request);

  const payload = await client.verifyJwt({ token, domain });

  return { fid: parseFid(payload.sub) };
}

export function isInvalidTokenError(e: unknown): boolean {
  return e instanceof Errors.InvalidTokenError;
}
