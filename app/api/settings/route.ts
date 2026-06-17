import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

// GET /api/settings — 현재 알림 설정
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    ok: true,
    data: {
      notifyEmail: user.notifyEmail,
      notifyKakao: user.notifyKakao,
      notifyPush: user.notifyPush,
      quietFrom: user.quietFrom,
      quietTo: user.quietTo,
    },
  });
}

// POST /api/settings — 알림 채널 토글/방해금지 시간 업데이트
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const b = await req.json().catch(() => ({}));
  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifyEmail: typeof b.notifyEmail === "boolean" ? b.notifyEmail : undefined,
      notifyKakao: typeof b.notifyKakao === "boolean" ? b.notifyKakao : undefined,
      notifyPush: typeof b.notifyPush === "boolean" ? b.notifyPush : undefined,
      quietFrom: typeof b.quietFrom === "number" ? b.quietFrom : undefined,
      quietTo: typeof b.quietTo === "number" ? b.quietTo : undefined,
    },
  });
  return NextResponse.json({ ok: true });
}
