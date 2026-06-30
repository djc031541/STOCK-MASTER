import { backtest } from "@/lib/backtest";
import { getCandles, getQuote, getQuotes } from "@/lib/datasources/yahoo";
import { computeLevels } from "@/lib/levels";
import { MARKET_META, WORLD_INDICES, classifyMarket } from "@/lib/markets";
import { displayName } from "@/lib/names";
import { fetchSentiment, scoreHeadline } from "@/lib/news-sentiment";
import { generateSignal, gradeFromScore, SIGNAL_LABEL } from "@/lib/signal";
import { UNIVERSE } from "@/lib/universe";
import type { Candle, RiskProfile } from "@/lib/types";

export function volatilityPct(candles: Candle[], period = 20) {
  const slice = candles.slice(-period);
  if (slice.length < 2) return 0;
  const returns = slice.slice(1).map((c, i) => (c.close - slice[i].close) / slice[i].close);
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + Math.pow(r - avg, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function volumeRatio(candles: Candle[], period = 20) {
  const last = candles[candles.length - 1]?.volume ?? 0;
  const prev = candles.slice(-period - 1, -1).filter((c) => c.volume > 0);
  if (!last || !prev.length) return 0;
  const avg = prev.reduce((sum, c) => sum + c.volume, 0) / prev.length;
  return avg ? last / avg : 0;
}

export function sectorOf(symbol: string) {
  const s = symbol.toUpperCase();
  if (["NVDA", "AMD", "AVGO", "INTC", "QCOM", "000660.KS"].includes(s)) return "반도체";
  if (["AAPL", "MSFT", "GOOGL", "META", "ORCL", "CRM", "035420.KS", "035720.KS"].includes(s)) return "빅테크/플랫폼";
  if (["JPM", "BAC", "105560.KS", "055550.KS"].includes(s)) return "금융";
  if (["TSLA", "005380.KS", "000270.KS", "7203.T"].includes(s)) return "자동차";
  if (["AMZN", "9988.HK", "3690.HK", "9618.HK"].includes(s)) return "소비/커머스";
  if (["207940.KS", "068270.KS"].includes(s)) return "바이오";
  return classifyMarket(symbol) === "KR" ? "국내 기타" : "글로벌 기타";
}

export async function analyzeSymbol(symbol: string, risk: RiskProfile) {
  const candles = await getCandles(symbol, "1y", "1d");
  const base = generateSignal(symbol, candles, risk);
  if (!base) return null;
  const name = displayName(symbol);
  const sentiment = await fetchSentiment(symbol, name);
  const score = Math.max(-100, Math.min(100, base.score + sentiment.contribution));
  const type = gradeFromScore(score, risk);
  const levels = computeLevels(candles, base.price);
  const bt = backtest(symbol, candles, risk);
  return {
    symbol,
    name,
    market: classifyMarket(symbol),
    sector: sectorOf(symbol),
    price: base.price,
    score: Math.round(score),
    techScore: base.score,
    newsScore: sentiment.contribution,
    newsLabel: sentiment.label,
    type,
    label: SIGNAL_LABEL[type].ko,
    rsi: base.indicators.rsi,
    trend: base.indicators.maShort != null && base.indicators.maLong != null
      ? base.indicators.maShort > base.indicators.maLong ? "상승" : "하락"
      : "중립",
    volatility: volatilityPct(candles),
    volumeRatio: volumeRatio(candles),
    levels,
    reasons: base.reasons,
    news: sentiment.headlines.map((n) => ({ ...n, ...scoreHeadline(n.title) })),
    backtest: bt
      ? {
          strategyReturnPct: bt.strategyReturnPct,
          buyHoldReturnPct: bt.buyHoldReturnPct,
          winRate: bt.winRate,
          maxDrawdownPct: bt.maxDrawdownPct,
          trades: bt.trades.length,
        }
      : null,
  };
}

export async function buildMarketRadar(market = "US") {
  const universe = UNIVERSE[market] ?? UNIVERSE.US;
  type RadarRow = {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    volumeRatio: number;
    divergence: string;
  };
  const rows = (
    await Promise.allSettled(
      universe.map(async (x): Promise<RadarRow> => {
        const [quote, candles] = await Promise.all([
          getQuote(x.symbol),
          getCandles(x.symbol, "3mo", "1d"),
        ]);
        const vr = volumeRatio(candles);
        const idxMove = quote.changePercent;
        return {
          symbol: x.symbol,
          name: x.name,
          price: quote.price,
          changePercent: quote.changePercent,
          volumeRatio: vr,
          divergence: Math.abs(idxMove) >= 2 ? "시장 급변 동조" : quote.changePercent >= 2 ? "강한 상대강도" : quote.changePercent <= -2 ? "약한 상대강도" : "보통",
        };
      })
    )
  )
    .filter((r): r is PromiseFulfilledResult<RadarRow> => r.status === "fulfilled")
    .map((r) => r.value);

  return {
    movers: [...rows].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 5),
    volumeSpikes: [...rows].sort((a, b) => b.volumeRatio - a.volumeRatio).slice(0, 5),
    divergences: rows.filter((r) => Math.abs(r.changePercent) >= 2 || r.volumeRatio >= 1.8).slice(0, 5),
  };
}

export async function buildBriefing(symbols: string[], risk: RiskProfile, market = "US") {
  const [indices, analyzed] = await Promise.all([
    getQuotes(WORLD_INDICES.map((x) => x.symbol)),
    Promise.all(symbols.slice(0, 8).map((s) => analyzeSymbol(s, risk))),
  ]);
  const valid = analyzed.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof analyzeSymbol>>>[];
  const indexAvg = indices.length ? indices.reduce((sum, q) => sum + q.changePercent, 0) / indices.length : 0;
  const mood = indexAvg > 0.5 ? "위험 선호" : indexAvg < -0.5 ? "위험 회피" : "혼조";
  const focus = [...valid].sort((a, b) => b.score - a.score).slice(0, 4);
  const riskNews = valid.flatMap((x) => x.news.filter((n) => n.label === "악재").map((n) => ({ symbol: x.symbol, title: n.title, source: n.source, impact: n.impact }))).slice(0, 5);

  return {
    title: `${MARKET_META[market]?.label ?? market} 장전/마감 투자 브리핑`,
    mood,
    indexAvg,
    generatedAt: new Date().toISOString(),
    focus,
    riskNews,
    actions: [
      focus[0] ? `${focus[0].symbol}는 종합 ${focus[0].score}점으로 우선 점검` : "관심종목을 추가해 우선순위를 생성",
      riskNews.length ? "악재 뉴스가 감지된 종목은 신규 진입 전 재확인" : "강한 악재 뉴스는 제한적",
      indexAvg < -1 ? "지수 약세 구간이므로 손절가를 먼저 고정" : "시장 흐름이 급락은 아니므로 분할 접근 가능",
    ],
  };
}
