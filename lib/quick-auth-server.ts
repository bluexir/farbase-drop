import { Errors, createClient } from "@farcaster/quick-auth";

type VerifiedUser = {
  fid: number;
};

const client = createClient();

function parseFid(sub: unknown): number {
  // Farcaster Quick Auth "sub" alanı bazı ortamlarda number, bazılarında string gelebiliyor.
  // Biz sadece pozitif integer FID kabul ediyoruz.
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

/**
 * Next.js Route Handler içinde:
 * - Authorization: Bearer <token> header'ını alır
 * - verifyJwt ile doğrular
 * - Token'dan fid (sub) döndürür
 */
export async function requireQuickAuthUser(request: Request): Promise<VerifiedUser> {
  const authorization =
    request.headers.get("authorization") || request.headers.get("Authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new Errors.InvalidTokenError("Missing token");
  }

  const token = authorization.slice("Bearer ".length).trim();

  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;

  const payload = await client.verifyJwt({
    token,
    domain: host,
  });

  return { fid: parseFid(payload.sub) };
}

export function isInvalidTokenError(e: unknown): boolean {
  return e instanceof Errors.InvalidTokenError;
}
