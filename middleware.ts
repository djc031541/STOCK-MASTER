import { NextRequest, NextResponse } from "next/server";

const COOKIE = "gta_session";

async function digest(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function expectedSession() {
  const password = process.env.APP_AUTH_PASSWORD;
  if (!password) return null;
  const secret = process.env.APP_AUTH_SECRET || password;
  return digest(`${password}:${secret}`);
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export async function middleware(req: NextRequest) {
  const expected = await expectedSession();
  if (!expected || isPublicPath(req.nextUrl.pathname)) return NextResponse.next();

  const actual = req.cookies.get(COOKIE)?.value;
  if (actual === expected) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "인증 필요" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

