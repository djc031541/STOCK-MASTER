// 기술적 지표 계산 — 외부 라이브러리 없이 순수 구현
// 입력은 종가 배열(오래된 → 최신 순서)을 기본으로 한다.

// 단순 이동평균 (SMA) — 마지막 값
export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// SMA 시계열 (각 시점의 이동평균) — 크로스 판정용
export function smaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return out;
}

// 지수 이동평균 (EMA) 시계열
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      // 첫 EMA는 SMA로 시드
      const seed =
        values.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
      continue;
    }
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// RSI (Wilder 방식, 기본 14)
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  // 초기 평균
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  // 이후 Wilder 스무딩
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const up = diff >= 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + down) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// MACD (12, 26, 9) — 마지막 macd/signal 값
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: number | null; signal: number | null; histPrev: number | null; hist: number | null } {
  if (values.length < slow + signalPeriod) {
    return { macd: null, signal: null, histPrev: null, hist: null };
  }
  const emaFast = emaSeries(values, fast);
  const emaSlow = emaSeries(values, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    if (f == null || s == null) continue;
    macdLine.push(f - s);
  }
  const signalSeries = emaSeries(macdLine, signalPeriod);
  const macdNow = macdLine[macdLine.length - 1] ?? null;
  const signalNow = signalSeries[signalSeries.length - 1] ?? null;
  const macdPrev = macdLine[macdLine.length - 2] ?? null;
  const signalPrev = signalSeries[signalSeries.length - 2] ?? null;
  const hist = macdNow != null && signalNow != null ? macdNow - signalNow : null;
  const histPrev =
    macdPrev != null && signalPrev != null ? macdPrev - signalPrev : null;
  return { macd: macdNow, signal: signalNow, hist, histPrev };
}

// 볼린저밴드 시계열 (차트 오버레이용) — 각 시점의 상/하단
export function bollingerSeries(
  values: number[],
  period = 20,
  mult = 2
): { upper: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    const mid = slice.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(
      slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period
    );
    upper.push(mid + mult * sd);
    lower.push(mid - mult * sd);
  }
  return { upper, lower };
}

// 볼린저밴드 (기본 20, 2σ)
export function bollinger(
  values: number[],
  period = 20,
  mult = 2
): { upper: number | null; lower: number | null; mid: number | null } {
  if (values.length < period) return { upper: null, lower: null, mid: null };
  const slice = values.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance =
    slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: mid + mult * sd, lower: mid - mult * sd, mid };
}
