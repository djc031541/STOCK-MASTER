import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/datasources/yahoo";
import { smaSeries, bollingerSeries } from "@/lib/indicators";

// GET /api/chart/:symbol?range=6mo
// 캔들 + 지표 시계열(MA20/MA60/볼린저밴드)을 차트용으로 반환.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "6mo";

  try {
    const candles = await getCandles(decodeURIComponent(symbol), range, "1d");
    if (!candles.length) {
      return NextResponse.json({ ok: false, error: "데이터 없음" }, { status: 404 });
    }

    const closes = candles.map((c) => c.close);
    const ma20 = smaSeries(closes, 20);
    const ma60 = smaSeries(closes, 60);
    const boll = bollingerSeries(closes, 20, 2);

    // lightweight-charts 형식: time 은 'yyyy-mm-dd'
    const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

    const ohlc = candles.map((c) => ({
      time: day(c.date),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const line = (arr: (number | null)[]) =>
      candles
        .map((c, i) => ({ time: day(c.date), value: arr[i] }))
        .filter((p) => p.value != null) as { time: string; value: number }[];

    return NextResponse.json({
      ok: true,
      data: {
        symbol,
        candles: ohlc,
        ma20: line(ma20),
        ma60: line(ma60),
        bbUpper: line(boll.upper),
        bbLower: line(boll.lower),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
