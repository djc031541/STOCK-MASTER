import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/datasources/yahoo";
import { generateSignal, gradeFromScore, SIGNAL_LABEL } from "@/lib/signal";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { classifyMarket } from "@/lib/markets";
import { displayName } from "@/lib/names";
import { fetchSentiment } from "@/lib/news-sentiment";
import { buildKid } from "@/lib/explain";
import { computeLevels } from "@/lib/levels";
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
        if (!sig) return { symbol, sig: null, senti: null, candles };
        // 최신 뉴스 감성 반영
        const senti = await fetchSentiment(symbol, displayName(symbol));
        return { symbol, sig, senti, candles };
      })
    );

    const data = results
      .filter(
        (r): r is PromiseFulfilledResult<{ symbol: string; sig: NonNullable<ReturnType<typeof generateSignal>>; senti: Awaited<ReturnType<typeof fetchSentiment>>; candles: Awaited<ReturnType<typeof getCandles>> }> =>
          r.status === "fulfilled" && r.value.sig !== null
      )
      .map((r) => {
        const s = r.value.sig;
        const senti = r.value.senti!;
        const i = s.indicators;
        const levels = computeLevels(r.value.candles, s.price);

        // 차트 점수 + 뉴스 감성 → 종합 점수로 재등급
        const combined = Math.max(-100, Math.min(100, s.score + senti.contribution));
        const type = gradeFromScore(combined, risk);
        const reasons = [...s.reasons];
        if (senti.contribution !== 0)
          reasons.push(`📰 최근 뉴스 ${senti.label}(호재 ${senti.pos} / 악재 ${senti.neg})`);
        const market = classifyMarket(s.symbol);
        const name = displayName(s.symbol);
        const kid = buildKid(name, type, combined, i, s.price, market, senti);

        return {
          symbol: s.symbol,
          name,
          market,
          type,
          label: SIGNAL_LABEL[type].ko,
          tone: SIGNAL_LABEL[type].tone,
          score: Math.round(combined),
          techScore: s.score,
          newsScore: senti.contribution,
          newsLabel: senti.label,
          price: s.price,
          rsi: i.rsi,
          reasons,
          kid,
          levels,
          news: senti.headlines,
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
