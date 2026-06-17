import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "gta_session";

export function authEnabled() {
  return Boolean(process.env.APP_AUTH_PASSWORD);
}

export function sessionDigest(password = process.env.APP_AUTH_PASSWORD || "") {
  const secret = process.env.APP_AUTH_SECRET || process.env.APP_AUTH_PASSWORD || "local";
  return createHash("sha256").update(`${password}:${secret}`).digest("hex");
}

export function verifyPassword(password: string) {
  const expected = process.env.APP_AUTH_PASSWORD;
  if (!expected) return true;
  const a = Buffer.from(sessionDigest(password));
  const b = Buffer.from(sessionDigest(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

