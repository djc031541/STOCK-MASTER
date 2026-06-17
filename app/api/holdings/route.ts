import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { classifyMarket } from "@/lib/markets";

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// POST /api/holdings body: { symbol, market?, qty, avgBuyPrice }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const portfolio = user.portfolio;
  if (!portfolio) {
    return NextResponse.json({ ok: false, error: "포트폴리오 없음" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const symbol = String(body.symbol || "").trim().toUpperCase();
  const qty = numberOrNull(body.qty);
  const avgBuyPrice = numberOrNull(body.avgBuyPrice);

  if (!symbol || qty == null || avgBuyPrice == null || qty <= 0 || avgBuyPrice < 0) {
    return NextResponse.json({ ok: false, error: "symbol, qty, avgBuyPrice를 확인하세요" }, { status: 400 });
  }

  const market = String(body.market || classifyMarket(symbol)).toUpperCase();
  const holding = await prisma.holding.upsert({
    where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol } },
    update: { market, qty, avgBuyPrice },
    create: { portfolioId: portfolio.id, symbol, market, qty, avgBuyPrice },
  });

  return NextResponse.json({ ok: true, data: holding });
}

