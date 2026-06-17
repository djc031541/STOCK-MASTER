import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, sessionDigest, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");

  if (!authEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ ok: false, error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, sessionDigest(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

