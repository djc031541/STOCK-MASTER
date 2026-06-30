import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/datasources/yahoo";
import { generateSignal, gradeFromScore, SIGNAL_LABEL } from "@/lib/signal";
import { getCurrentUser } from "@/lib/user";
import { UNIVERSE } from "@/lib/universe";
import { fetchSentiment } from "@/lib/news-sentiment";
import { computeLevels } from "@/lib/levels";
import type { RiskProfile } from "@/lib/types";

// GET /api/recommend?market=US&risk=중립
// 해당 국가 유니버스를 신호 스캔 → 점수 높은 순으로 추천.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = (searchParams.get("market") || "US").toUpperCase();
  const list = UNIVERSE[market];
  if (!list) {
    return NextResponse.json({ ok: false, error: "지원하지 않는 국가" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const risk =
    (searchParams.get("risk") as RiskProfile) || (user.riskProfile as RiskProfile) || "중립";

  const nameMap = new Map(list.map((x) => [x.symbol, x.name]));

  const settled = await Promise.allSettled(
    list.map(async (x) => {
      const candles = await getCandles(x.symbol, "1y", "1d");
      const signal = generateSignal(x.symbol, candles, risk);
      if (!signal) return null;
      const sentiment = await fetchSentiment(x.symbol, x.name);
      return { signal, candles, sentiment };
    })
  );

  const rows = settled
    .filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        signal: NonNullable<ReturnType<typeof generateSignal>>;
        candles: Awaited<ReturnType<typeof getCandles>>;
        sentiment: Awaited<ReturnType<typeof fetchSentiment>>;
      }> => r.status === "fulfilled" && r.value !== null
    )
    .map((r) => {
      const s = r.value.signal;
      const newsScore = r.value.sentiment.contribution;
      const score = Math.max(-100, Math.min(100, s.score + newsScore));
      const type = gradeFromScore(score, risk);
      const levels = computeLevels(r.value.candles, s.price);
      const name = nameMap.get(s.symbol) ?? s.symbol;
      const reasons = [...s.reasons];
      if (newsScore !== 0) {
        reasons.push(
          `최근 뉴스 ${r.value.sentiment.label}(호재 ${r.value.sentiment.pos} / 악재 ${r.value.sentiment.neg})`
        );
      }

      const strengths = reasons.filter((reason) => !/하락|데드|과매수|상단|악재|부정|약세/.test(reason));
      const risks = reasons.filter((reason) => /하락|데드|과매수|상단|악재|부정|약세/.test(reason));
      const allocationHint =
        score >= 55
          ? "분할 매수 2~3회, 총 투자금의 10~15% 이내"
          : score >= 30
            ? "소액 분할 진입, 총 투자금의 5~10% 이내"
            : score >= 10
              ? "관찰 우선, 첫 진입은 5% 이내"
              : "매수보다 관망 우선";

      return {
        symbol: s.symbol,
        name,
        type,
        label: SIGNAL_LABEL[type].ko,
        tone: SIGNAL_LABEL[type].tone,
        score: Math.round(score),
        techScore: s.score,
        newsScore,
        newsLabel: r.value.sentiment.label,
        price: s.price,
        rsi: s.indicators.rsi,
        reasons,
        levels,
        confidence:
          score >= 55 ? "높음" : score >= 30 ? "보통 이상" : score >= 10 ? "보통" : "낮음",
        allocationHint,
        summary: `${name}는 기술점수 ${s.score}점과 뉴스점수 ${newsScore >= 0 ? "+" : ""}${newsScore}점을 합산해 ${Math.round(score)}점입니다.`,
        strengths: strengths.length ? strengths.slice(0, 3) : ["뚜렷한 강점 신호가 아직 약합니다."],
        risks: risks.length ? risks.slice(0, 3) : ["특별한 단기 위험 신호는 제한적입니다."],
        actionPlan: [
          `진입 후보가: 현재가 ${s.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} 부근`,
          `목표가: ${levels.target.toLocaleString("ko-KR")} (${levels.targetPct.toFixed(1)}%)`,
          `손절가: ${levels.stop.toLocaleString("ko-KR")} (${levels.stopPct.toFixed(1)}%)`,
        ],
        checklist: [
          "당일 지수와 섹터 흐름이 같이 강한지 확인",
          "거래량이 최근 평균보다 줄지 않았는지 확인",
          "목표가와 손절가를 먼저 정한 뒤 분할 진입",
        ],
        news: r.value.sentiment.headlines,
      };
    })
    // 매수 우호 순(점수 내림차순)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    ok: true,
    market,
    risk,
    generatedAt: new Date().toISOString(),
    data: rows,
  });
}
