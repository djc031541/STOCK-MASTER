import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { classifyMarket } from "@/lib/markets";

function numberOrUndefined(value: unknown) {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function ownedHolding(id: string) {
  const user = await getCurrentUser();
  if (!user.portfolio) return null;
  return prisma.holding.findFirst({ where: { id, portfolioId: user.portfolio.id } });
}

// PATCH /api/holdings/:id body: { symbol?, market?, qty?, avgBuyPrice? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const current = await ownedHolding(id);
  if (!current) return NextResponse.json({ ok: false, error: "보유종목 없음" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const symbol = body.symbol ? String(body.symbol).trim().toUpperCase() : undefined;
  const qty = numberOrUndefined(body.qty);
  const avgBuyPrice = numberOrUndefined(body.avgBuyPrice);

  if ((qty != null && qty <= 0) || (avgBuyPrice != null && avgBuyPrice < 0)) {
    return NextResponse.json({ ok: false, error: "수량/평단가를 확인하세요" }, { status: 400 });
  }

  const updated = await prisma.holding.update({
    where: { id },
    data: {
      symbol,
      market: body.market ? String(body.market).toUpperCase() : symbol ? classifyMarket(symbol) : undefined,
      qty,
      avgBuyPrice,
    },
  });
  return NextResponse.json({ ok: true, data: updated });
}

// DELETE /api/holdings/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const current = await ownedHolding(id);
  if (!current) return NextResponse.json({ ok: false, error: "보유종목 없음" }, { status: 404 });

  await prisma.holding.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

