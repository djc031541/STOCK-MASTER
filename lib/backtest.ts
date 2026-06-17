// 백테스팅 — 과거 일봉에 신호 전략을 적용해 수익률을 검증한다.
// 전략: 매 거래일마다 그 시점까지의 데이터로 신호 계산 →
//   BUY/STRONG_BUY 면서 미보유 → 전량 매수, SELL/STRONG_SELL 이면서 보유 → 전량 매도.
// Buy & Hold 와 비교한다.

import type { Candle, RiskProfile } from "@/lib/types";
import { generateSignal } from "@/lib/signal";

export type Trade = {
  date: string;
  action: "BUY" | "SELL";
  price: number;
};

export type BacktestResult = {
  symbol: string;
  risk: RiskProfile;
  from: string;
  to: string;
  bars: number;
  trades: Trade[];
  strategyReturnPct: number; // 전략 누적 수익률
  buyHoldReturnPct: number; // 매수후보유 수익률
  winRate: number; // 매도시 수익난 비율
  maxDrawdownPct: number; // 전략 최대낙폭
};

const MIN_BARS = 60; // 지표 워밍업

export function backtest(
  symbol: string,
  candles: Candle[],
  risk: RiskProfile = "중립"
): BacktestResult | null {
  if (candles.length < MIN_BARS + 5) return null;

  let cash = 1; // 1.0 = 100% 현금에서 시작
  let shares = 0;
  let holding = false;
  let buyPrice = 0;
  const trades: Trade[] = [];
  let wins = 0;
  let sells = 0;

  const equityCurve: number[] = [];

  for (let i = MIN_BARS; i < candles.length; i++) {
    const window = candles.slice(0, i + 1); // 미래 정보 누설 방지
    const price = candles[i].close;
    const date = new Date(candles[i].date * 1000).toISOString().slice(0, 10);
    const sig = generateSignal(symbol, window, risk);
    if (!sig) continue;

    const buySignal = sig.type === "BUY" || sig.type === "STRONG_BUY";
    const sellSignal = sig.type === "SELL" || sig.type === "STRONG_SELL";

    if (buySignal && !holding) {
      shares = cash / price;
      cash = 0;
      holding = true;
      buyPrice = price;
      trades.push({ date, action: "BUY", price });
    } else if (sellSignal && holding) {
      cash = shares * price;
      shares = 0;
      holding = false;
      sells++;
      if (price > buyPrice) wins++;
      trades.push({ date, action: "SELL", price });
    }

    const equity = holding ? shares * price : cash;
    equityCurve.push(equity);
  }

  // 마지막에 보유 중이면 청산 가치로 마감
  const lastPrice = candles[candles.length - 1].close;
  const finalEquity = holding ? shares * lastPrice : cash;

  const strategyReturnPct = (finalEquity - 1) * 100;
  const firstClose = candles[MIN_BARS].close;
  const buyHoldReturnPct = ((lastPrice - firstClose) / firstClose) * 100;

  // 최대 낙폭
  let peak = -Infinity;
  let maxDd = 0;
  for (const e of equityCurve) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    symbol,
    risk,
    from: new Date(candles[MIN_BARS].date * 1000).toISOString().slice(0, 10),
    to: new Date(candles[candles.length - 1].date * 1000).toISOString().slice(0, 10),
    bars: candles.length - MIN_BARS,
    trades,
    strategyReturnPct,
    buyHoldReturnPct,
    winRate: sells ? (wins / sells) * 100 : 0,
    maxDrawdownPct: maxDd * 100,
  };
}
