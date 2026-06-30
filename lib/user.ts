// 개인 아이디 기반 멀티유저.
//   쿠키 gta_uid 에 담긴 아이디로 사용자를 구분한다(없으면 데모 계정).
//   신규 아이디는 기본 워치리스트 + 시드머니로 자동 생성된다.

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_WATCHLIST } from "@/lib/markets";

export const UID_COOKIE = "gta_uid";
export const DEMO_EMAIL = "me@local";

// 아이디 → 내부 이메일 키 (충돌 방지 위해 접두)
function emailFor(uid: string) {
  return `uid:${uid.trim().toLowerCase()}`;
}

async function ensureUser(email: string) {
  let user = await prisma.user.findUnique({
    where: { email },
    include: { portfolio: { include: { holdings: true } }, watchlist: true },
  });
  if (user) return user;

  // 신규 유저 생성 + 기본 워치리스트 시드
  await prisma.user.create({
    data: {
      email,
      portfolio: { create: { baseCurrency: "KRW", seedAmount: 10000000 } },
      watchlist: {
        create: DEFAULT_WATCHLIST.map((w) => ({ symbol: w.symbol, market: w.market })),
      },
    },
  });
  user = await prisma.user.findUnique({
    where: { email },
    include: { portfolio: { include: { holdings: true } }, watchlist: true },
  });
  return user!;
}

// 현재 로그인된 사용자 (쿠키 기준). 없으면 데모.
export async function getCurrentUser() {
  let email = DEMO_EMAIL;
  try {
    const c = await cookies();
    const uid = c.get(UID_COOKIE)?.value;
    if (uid) email = emailFor(uid);
  } catch {
    // 쿠키 접근 불가 컨텍스트 → 데모
  }
  return ensureUser(email);
}

// 현재 아이디 문자열 (표시용). 데모면 null.
export async function getCurrentUid(): Promise<string | null> {
  try {
    const c = await cookies();
    return c.get(UID_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export { emailFor };
