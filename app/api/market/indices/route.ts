import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/datasources/yahoo";
import { WORLD_INDICES } from "@/lib/markets";

// GET /api/market/indices — 세계 주요 지수 + 환율 실시간 시세
export async function GET() {
  try {
    const quotes = await getQuotes(WORLD_INDICES.map((i) => i.symbol));
    const labelMap = new Map(WORLD_INDICES.map((i) => [i.symbol, i.label]));

    const data = quotes.map((q) => ({
      symbol: q.symbol,
      label: labelMap.get(q.symbol) ?? q.name,
      price: q.price,
      changePercent: q.changePercent,
      currency: q.currency,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
