// 알림 디스패처 — 실제 채널 연동.
//   이메일: SMTP(nodemailer) 또는 Resend. 자격증명 없으면 개발용 Ethereal 테스트 메일(미리보기 URL).
//   카카오: "나에게 보내기"(메모 API, 무료) — KAKAO_ACCESS_TOKEN 필요.
//   푸시(FCM): 자격증명 있을 때만(스텁).
// 모든 채널은 키가 없으면 콘솔 로그로 폴백한다.

import nodemailer from "nodemailer";

export type NotifyChannel = "push" | "kakao" | "email" | "log";

export type NotifyMessage = {
  title: string;
  body: string;
  channels?: NotifyChannel[];
};

export type ChannelResult = { channel: NotifyChannel; ok: boolean; detail: string };

// ── 이메일 ───────────────────────────────────────────────
async function sendViaResend(m: NotifyMessage, to: string): Promise<ChannelResult> {
  const from = process.env.NOTIFY_EMAIL_FROM || "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: m.title,
      text: m.body,
      html: m.body.replace(/\n/g, "<br>"),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { channel: "email", ok: false, detail: `Resend 실패: ${res.status} ${t.slice(0, 120)}` };
  }
  return { channel: "email", ok: true, detail: `Resend 발송 → ${to}` };
}

async function sendViaSmtp(m: NotifyMessage, to: string, url: string): Promise<ChannelResult> {
  const transport = nodemailer.createTransport(url);
  const from = process.env.NOTIFY_EMAIL_FROM || "GlobalTrade Advisor <no-reply@gta.local>";
  await transport.sendMail({ from, to, subject: m.title, text: m.body, html: m.body.replace(/\n/g, "<br>") });
  return { channel: "email", ok: true, detail: `SMTP 발송 → ${to}` };
}

// 자격증명 없을 때 개발 검증용: Ethereal 테스트 계정으로 보내고 미리보기 URL 반환
async function sendViaEthereal(m: NotifyMessage, to: string): Promise<ChannelResult> {
  const acc = await nodemailer.createTestAccount();
  const transport = nodemailer.createTransport({
    host: acc.smtp.host,
    port: acc.smtp.port,
    secure: acc.smtp.secure,
    auth: { user: acc.user, pass: acc.pass },
  });
  const info = await transport.sendMail({
    from: "GlobalTrade Advisor <test@ethereal.email>",
    to,
    subject: m.title,
    text: m.body,
    html: m.body.replace(/\n/g, "<br>"),
  });
  const preview = nodemailer.getTestMessageUrl(info);
  return { channel: "email", ok: true, detail: `Ethereal 테스트 메일 — 미리보기: ${preview}` };
}

async function sendEmail(m: NotifyMessage): Promise<ChannelResult> {
  const to = process.env.NOTIFY_EMAIL_TO || "test@example.com";
  try {
    if (process.env.SMTP_URL) return await sendViaSmtp(m, to, process.env.SMTP_URL);
    if (process.env.RESEND_API_KEY) return await sendViaResend(m, to);
    if (process.env.NODE_ENV !== "production") return await sendViaEthereal(m, to);
    return { channel: "email", ok: false, detail: "이메일 자격증명 없음(스킵)" };
  } catch (e) {
    return { channel: "email", ok: false, detail: `이메일 오류: ${(e as Error).message}` };
  }
}

// ── 카카오 "나에게 보내기" (메모 API) ────────────────────
async function kakaoMemo(token: string, m: NotifyMessage): Promise<Response> {
  const template = {
    object_type: "text",
    text: `${m.title}\n\n${m.body}`,
    link: { web_url: "http://localhost:3000", mobile_web_url: "http://localhost:3000" },
    button_title: "대시보드 열기",
  };
  return fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `template_object=${encodeURIComponent(JSON.stringify(template))}`,
  });
}

// access token 만료 시 refresh token 으로 재발급
async function refreshKakaoToken(): Promise<string | null> {
  const refresh = process.env.KAKAO_REFRESH_TOKEN;
  const restKey = process.env.KAKAO_REST_KEY;
  if (!refresh || !restKey) return null;
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: restKey,
      refresh_token: refresh,
    }).toString(),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

async function sendKakao(m: NotifyMessage): Promise<ChannelResult> {
  let token = process.env.KAKAO_ACCESS_TOKEN;
  if (!token) return { channel: "kakao", ok: false, detail: "카카오 토큰 없음(스킵)" };
  try {
    let res = await kakaoMemo(token, m);
    if (res.status === 401) {
      // 토큰 만료 → 갱신 후 재시도
      const fresh = await refreshKakaoToken();
      if (fresh) {
        token = fresh;
        res = await kakaoMemo(token, m);
      }
    }
    if (!res.ok) {
      const t = await res.text();
      return { channel: "kakao", ok: false, detail: `카카오 실패: ${res.status} ${t.slice(0, 120)}` };
    }
    return { channel: "kakao", ok: true, detail: "카카오 '나에게 보내기' 발송" };
  } catch (e) {
    return { channel: "kakao", ok: false, detail: `카카오 오류: ${(e as Error).message}` };
  }
}

// ── 푸시(FCM) — 스텁 ─────────────────────────────────────
async function sendPush(m: NotifyMessage): Promise<ChannelResult> {
  if (!process.env.FCM_SERVER_KEY) return { channel: "push", ok: false, detail: "FCM 자격증명 없음(스킵)" };
  // TODO: FCM HTTP v1 연동
  return { channel: "push", ok: true, detail: "푸시 발송(스텁)" };
}

function sendLog(m: NotifyMessage): ChannelResult {
  console.log(`\n🔔 [알림] ${m.title}\n${m.body}\n`);
  return { channel: "log", ok: true, detail: "콘솔 로그" };
}

export function isQuietHour(hour: number, from: number, to: number): boolean {
  if (from <= to) return hour >= from && hour < to;
  return hour >= from || hour < to;
}

export async function dispatch(m: NotifyMessage): Promise<ChannelResult[]> {
  const channels = m.channels ?? ["log"];
  const results: ChannelResult[] = [];
  for (const ch of channels) {
    try {
      if (ch === "email") results.push(await sendEmail(m));
      else if (ch === "kakao") results.push(await sendKakao(m));
      else if (ch === "push") results.push(await sendPush(m));
      else results.push(sendLog(m));
    } catch (e) {
      results.push({ channel: ch, ok: false, detail: (e as Error).message });
    }
  }
  // 활성 채널이 모두 실패하면 로그로 폴백
  if (!results.some((r) => r.ok)) results.push(sendLog(m));
  return results;
}
