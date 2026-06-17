// 단일 사용자 로컬 앱: 고정 데모 계정을 보장한다.
// (멀티유저로 확장 시 인증 붙이고 이 함수만 교체)

import { prisma } from "@/lib/prisma";

export const DEMO_EMAIL = "me@local";

export async function getCurrentUser() {
  let user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { portfolio: { include: { holdings: true } }, watchlist: true },
  });

  if (!user) {
    await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        portfolio: { create: { baseCurrency: "KRW", seedAmount: 10000000 } },
      },
    });
    user = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      include: { portfolio: { include: { holdings: true } }, watchlist: true },
    });
  }

  return user!;
}
