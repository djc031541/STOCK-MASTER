import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { valuatePortfolio } from "@/lib/portfolio";

// GET /api/portfolio — 실시간 평가손익 요약
export async function GET() {
  const user = await getCurrentUser();
  const p = user.portfolio;
  if (!p) return NextResponse.json({ ok: false, error: "포트폴리오 없음" }, { status: 404 });

  try {
    const summary = await valuatePortfolio(
      p.seedAmount,
      p.cashBalance,
      p.holdings.map((h) => ({
        id: h.id,
        symbol: h.symbol,
        market: h.market,
        qty: h.qty,
        avgBuyPrice: h.avgBuyPrice,
      })),
      p.baseCurrency
    );
    return NextResponse.json({ ok: true, data: summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/portfolio  body: { seedAmount?, cashBalance?, riskProfile? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));

  if (body.riskProfile && ["안정", "중립", "공격"].includes(body.riskProfile)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { riskProfile: body.riskProfile },
    });
  }
  if (user.portfolio && (body.seedAmount != null || body.cashBalance != null)) {
    await prisma.portfolio.update({
      where: { id: user.portfolio.id },
      data: {
        seedAmount: body.seedAmount ?? undefined,
        cashBalance: body.cashBalance ?? undefined,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
