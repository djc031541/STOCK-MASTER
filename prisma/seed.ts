// 데모 데이터 시드: 사용자 + 포트폴리오 + 보유종목 + 워치리스트
// 실행: npm run db:seed

import { PrismaClient } from "@prisma/client";
import { DEFAULT_WATCHLIST } from "../lib/markets";

const prisma = new PrismaClient();
const EMAIL = "me@local";

async function main() {
  // 사용자 + 포트폴리오
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      email: EMAIL,
      portfolio: { create: { baseCurrency: "KRW", seedAmount: 10000000, cashBalance: 3000000 } },
    },
    include: { portfolio: true },
  });

  // 보유종목 (데모) — 평균단가는 예시값
  const holdings = [
    { symbol: "NVDA", market: "US", qty: 5, avgBuyPrice: 150 },
    { symbol: "AAPL", market: "US", qty: 10, avgBuyPrice: 210 },
    { symbol: "005930.KS", market: "KR", qty: 20, avgBuyPrice: 70000 },
  ];
  for (const h of holdings) {
    const exists = await prisma.holding.findFirst({
      where: { portfolioId: user.portfolio!.id, symbol: h.symbol },
    });
    if (!exists) {
      await prisma.holding.create({
        data: { ...h, portfolioId: user.portfolio!.id },
      });
    }
  }

  // 워치리스트
  for (const w of DEFAULT_WATCHLIST) {
    await prisma.watchlist.upsert({
      where: { userId_symbol: { userId: user.id, symbol: w.symbol } },
      update: {},
      create: { userId: user.id, symbol: w.symbol, market: w.market },
    });
  }

  console.log("✅ 시드 완료: 사용자/포트폴리오/보유종목/워치리스트");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
