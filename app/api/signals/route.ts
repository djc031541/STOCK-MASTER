import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/datasources/yahoo";
import { generateSignal, SIGNAL_LABEL } from "@/lib/signal";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { classifyMarket } from "@/lib/markets";
import type { RiskProfile } from "@/lib/types";

// GET /api/signals?risk=중립&symbols=NVDA,AAPL
// 워치리스트 각 종목의 매수/매도 신호를 계산해서 반환.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols");

  // 리스크 성향: 쿼리 우선, 없으면 사용자 설정값
  const user = await getCurrentUser();
  const risk =
    (searchParams.get("risk") as RiskProfile) ||
    (user.riskProfile as RiskProfile) ||
    "중립";

  // 대상 심볼: 쿼리 우선, 없으면 DB 워치리스트
  let symbols: string[];
  if (symbolsParam) {
    symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    const wl = await prisma.watchlist.findMany({ where: { userId: user.id } });
    symbols = wl.map((w) => w.symbol);
  }

  try {
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const candles = await getCandles(symbol, "1y", "1d");
        const sig = generateSignal(symbol, candles, risk);
        return { symbol, sig };
      })
    );

    const data = results
      .filter(
        (r): r is PromiseFulfilledResult<{ symbol: string; sig: ReturnType<typeof generateSignal> }> =>
          r.status === "fulfilled" && r.value.sig !== null
      )
      .map((r) => {
        const s = r.value.sig!;
        const i = s.indicators;
        return {
          symbol: s.symbol,
          market: classifyMarket(s.symbol),
          type: s.type,
          label: SIGNAL_LABEL[s.type].ko,
          tone: SIGNAL_LABEL[s.type].tone,
          score: s.score,
          price: s.price,
          rsi: i.rsi,
          reasons: s.reasons,
          // 펼침 카드용 지표 스냅샷
          indicators: {
            rsi: i.rsi,
            maTrend: i.maShort != null && i.maLong != null ? (i.maShort > i.maLong ? "상승" : "하락") : null,
            goldenCross: i.goldenCross,
            deadCross: i.deadCross,
            macdState: i.macd != null && i.macdSignal != null ? (i.macd > i.macdSignal ? "상향" : "하향") : null,
            macdCrossUp: i.macdCrossUp,
            macdCrossDown: i.macdCrossDown,
            touchedLower: i.touchedLower,
            touchedUpper: i.touchedUpper,
          },
        };
      });

    return NextResponse.json({ ok: true, risk, data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
