import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "tl_admin";

function expectedCookieValue(): string | null {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (!pw) return null;
  return createHash("sha256").update(`throughline:${pw}`).digest("hex");
}

export function verifyPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (!pw) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(pw);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function grantAdmin(): Promise<void> {
  const value = expectedCookieValue();
  if (!value) return;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedCookieValue();
  if (!expected) return false;
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  return value === expected;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}
