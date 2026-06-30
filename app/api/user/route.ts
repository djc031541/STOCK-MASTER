import { NextRequest, NextResponse } from "next/server";
import { UID_COOKIE, getCurrentUid } from "@/lib/user";

// GET /api/user — 현재 로그인 아이디
export async function GET() {
  const uid = await getCurrentUid();
  return NextResponse.json({ ok: true, uid });
}

// POST /api/user  body: { id }  — 아이디로 로그인(쿠키 설정). id 없으면 로그아웃.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "").trim().toLowerCase();

  const res = NextResponse.json({ ok: true, uid: id || null });
  if (id) {
    // 영문/숫자/일부기호만 허용 (간단 검증)
    if (!/^[a-z0-9._-]{2,20}$/.test(id)) {
      return NextResponse.json({ ok: false, error: "아이디는 영문/숫자 2~20자" }, { status: 400 });
    }
    res.cookies.set(UID_COOKIE, id, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    res.cookies.delete(UID_COOKIE);
  }
  return res;
}
