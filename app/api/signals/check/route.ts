import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { checkUserSignals } from "@/lib/signal-check";

// POST /api/signals/check — 워치리스트 신호 점검 + 변화 시 알림 발송
// (cron 으로 분/시간 단위 호출하면 자동 모니터링이 된다)
export async function POST() {
  try {
    const user = await getCurrentUser();
    const outcomes = await checkUserSignals(user.id);
    const notified = outcomes.filter((o) => o.notified);
    return NextResponse.json({
      ok: true,
      notifiedCount: notified.length,
      outcomes,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
