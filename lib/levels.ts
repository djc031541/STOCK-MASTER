// 추천 목표 매도가(익절) / 손절가 계산 — 변동성(ATR) 기반.
//   하루 평균 변동폭(ATR%)을 구해, 익절은 약 3×ATR 위, 손절은 약 1.5×ATR 아래.
//   (위험 대비 보상 ≈ 2:1) 변동성이 큰 종목은 목표/손절 폭도 넓어진다.

import type { Candle } from "@/lib/types";

export type Levels = {
  target: number; // 추천 목표 매도가 (익절)
  targetPct: number; // 현재가 대비 %
  stop: number; // 추천 손절가
  stopPct: number; // 현재가 대비 % (음수)
};

function atrPercent(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0.02; // 기본 2%
  let sum = 0;
  const start = candles.length - period;
  for (let i = start; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    sum += tr / c.close;
  }
  return sum / period; // 평균 TR 비율
}

export function computeLevels(candles: Candle[], price: number): Levels {
  const atr = atrPercent(candles, 14);
  // 폭 제한: 너무 좁거나(±1.5%) 너무 넓지(±25%) 않게
  const upPct = Math.min(0.25, Math.max(0.03, atr * 3));
  const downPct = Math.min(0.15, Math.max(0.015, atr * 1.5));
  const round = (n: number) => (price >= 1000 ? Math.round(n) : Math.round(n * 100) / 100);
  return {
    target: round(price * (1 + upPct)),
    targetPct: upPct * 100,
    stop: round(price * (1 - downPct)),
    stopPct: -downPct * 100,
  };
}
