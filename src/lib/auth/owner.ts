import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const OWNER_COOKIE = "tl_owner";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Returns the current visitor's raw owner token, creating and setting the cookie if needed.
 * The raw token lives only in an httpOnly cookie. Sessions store the hash, so the raw token
 * never touches the database.
 */
export async function ensureOwnerToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;
  if (existing) return existing;

  const raw = randomBytes(32).toString("hex");
  jar.set(OWNER_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
    secure: process.env.NODE_ENV === "production",
  });
  return raw;
}

export async function currentOwnerToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(OWNER_COOKIE)?.value ?? null;
}
