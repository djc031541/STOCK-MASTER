import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { dispatch, type NotifyChannel } from "@/lib/notify";

// POST /api/notify/test — 사용자가 켜둔 채널로 테스트 알림 발송 후 채널별 결과 반환.
// (자격증명 추가 후 정상 연동됐는지 확인용)
export async function POST() {
  const user = await getCurrentUser();
  const channels: NotifyChannel[] = [];
  if (user.notifyPush) channels.push("push");
  if (user.notifyKakao) channels.push("kakao");
  if (user.notifyEmail) channels.push("email");
  if (!channels.length) channels.push("log");

  const results = await dispatch({
    title: "🔔 GlobalTrade Advisor 테스트 알림",
    body:
      "알림 채널이 정상 연동되었는지 확인하는 테스트 메시지입니다.\n" +
      "이 메시지를 받으셨다면 설정이 완료된 것입니다.\n" +
      "※ 투자 참고용 정보이며 최종 책임은 본인에게 있습니다.",
    channels,
  });

  return NextResponse.json({ ok: true, channels, results });
}
