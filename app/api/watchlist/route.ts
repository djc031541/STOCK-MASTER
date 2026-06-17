import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

// GET /api/watchlist — 내 워치리스트
export async function GET() {
  const user = await getCurrentUser();
  const items = await prisma.watchlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ok: true, data: items });
}

// POST /api/watchlist  body: { symbol, market?, targetPrice?, stopLoss? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const symbol = String(body.symbol || "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json(
      { ok: false, error: "symbol이 필요합니다" },
      { status: 400 }
    );
  }
  try {
    const item = await prisma.watchlist.upsert({
      where: { userId_symbol: { userId: user.id, symbol } },
      update: {
        targetPrice: body.targetPrice ?? undefined,
        stopLoss: body.stopLoss ?? undefined,
      },
      create: {
        userId: user.id,
        symbol,
        market: body.market || "US",
        targetPrice: body.targetPrice ?? null,
        stopLoss: body.stopLoss ?? null,
      },
    });
    return NextResponse.json({ ok: true, data: item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
