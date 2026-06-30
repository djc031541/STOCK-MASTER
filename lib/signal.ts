// 매수·매도 신호 엔진
// 캔들(일봉) → 지표 계산 → 가중 점수 합산(-100~+100) → 리스크 성향별 등급화

import type {
  Candle,
  IndicatorSnapshot,
  RiskProfile,
  SignalResult,
  SignalType,
} from "@/lib/types";
import { bollinger, macd, rsi, smaSeries } from "@/lib/indicators";

// 지표별 가중치 (합 100)
const WEIGHTS = {
  ma: 30,
  rsi: 25,
  macd: 25,
  bollinger: 20,
};

// 리스크 성향별 매수/매도 임계값 (점수 절대값)
// 너무 높으면 늘 '관망'만 나와서, 실제로 등급이 갈리도록 현실적으로 낮춤.
const THRESHOLDS: Record<RiskProfile, { buy: number; strong: number }> = {
  공격: { buy: 12, strong: 30 },
  중립: { buy: 18, strong: 38 },
  안정: { buy: 28, strong: 50 },
};

export function computeIndicators(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);

  // 이동평균 크로스 (단기 20 / 장기 60)
  const shortSeries = smaSeries(closes, 20);
  const longSeries = smaSeries(closes, 60);
  const sNow = shortSeries[shortSeries.length - 1];
  const sPrev = shortSeries[shortSeries.length - 2];
  const lNow = longSeries[longSeries.length - 1];
  const lPrev = longSeries[longSeries.length - 2];

  const goldenCross =
    sPrev != null && lPrev != null && sNow != null && lNow != null
      ? sPrev <= lPrev && sNow > lNow
      : false;
  const deadCross =
    sPrev != null && lPrev != null && sNow != null && lNow != null
      ? sPrev >= lPrev && sNow < lNow
      : false;

  const rsiVal = rsi(closes, 14);

  const m = macd(closes, 12, 26, 9);
  const macdCrossUp =
    m.histPrev != null && m.hist != null ? m.histPrev <= 0 && m.hist > 0 : false;
  const macdCrossDown =
    m.histPrev != null && m.hist != null ? m.histPrev >= 0 && m.hist < 0 : false;

  const boll = bollinger(closes, 20, 2);
  const lastClose = closes[closes.length - 1];
  const touchedLower =
    boll.lower != null ? lastClose <= boll.lower : false;
  const touchedUpper =
    boll.upper != null ? lastClose >= boll.upper : false;

  return {
    rsi: rsiVal,
    maShort: sNow ?? null,
    maLong: lNow ?? null,
    goldenCross,
    deadCross,
    macd: m.macd,
    macdSignal: m.signal,
    macdCrossUp,
    macdCrossDown,
    bollUpper: boll.upper,
    bollLower: boll.lower,
    touchedLower,
    touchedUpper,
  };
}

// 지표 스냅샷 → 점수(-100~+100) + 사람이 읽을 근거
function scoreFromIndicators(ind: IndicatorSnapshot): {
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // 1) 이동평균 크로스
  if (ind.goldenCross) {
    score += WEIGHTS.ma;
    reasons.push("골든크로스 발생(단기선이 장기선 상향 돌파)");
  } else if (ind.deadCross) {
    score -= WEIGHTS.ma;
    reasons.push("데드크로스 발생(단기선이 장기선 하향 돌파)");
  } else if (ind.maShort != null && ind.maLong != null) {
    // 크로스가 없어도 추세 지속을 반영 (추세추종형 매수/매도가 가능하도록)
    const gap = (ind.maShort - ind.maLong) / ind.maLong; // 이격도
    const trend = ind.maShort > ind.maLong ? 1 : -1;
    // 이격이 클수록 추세 신뢰도 ↑ (0.5~0.85 가중)
    const conf = Math.min(0.85, 0.5 + Math.abs(gap) * 8);
    score += trend * WEIGHTS.ma * conf;
    reasons.push(trend > 0 ? "20일선이 60일선 위 — 상승추세 지속" : "20일선이 60일선 아래 — 하락추세 지속");
  }

  // 2) RSI
  if (ind.rsi != null) {
    if (ind.rsi <= 30) {
      score += WEIGHTS.rsi;
      reasons.push(`RSI ${ind.rsi.toFixed(0)} — 과매도(너무 많이 떨어짐, 반등 기대)`);
    } else if (ind.rsi >= 70) {
      score -= WEIGHTS.rsi;
      reasons.push(`RSI ${ind.rsi.toFixed(0)} — 과매수(너무 많이 오름, 조정 주의)`);
    } else {
      // 중립 구간: 50 기준 선형 가감 (기여도 강화)
      const tilt = (50 - ind.rsi) / 20; // 30~70 → +1~-1
      score += tilt * WEIGHTS.rsi * 0.7;
      if (ind.rsi >= 55) reasons.push(`RSI ${ind.rsi.toFixed(0)} — 다소 강세`);
      else if (ind.rsi <= 45) reasons.push(`RSI ${ind.rsi.toFixed(0)} — 다소 약세`);
    }
  }

  // 3) MACD 크로스
  if (ind.macdCrossUp) {
    score += WEIGHTS.macd;
    reasons.push("MACD 골든크로스(시그널선 상향 돌파)");
  } else if (ind.macdCrossDown) {
    score -= WEIGHTS.macd;
    reasons.push("MACD 데드크로스(시그널선 하향 돌파)");
  } else if (ind.macd != null && ind.macdSignal != null) {
    const dir = ind.macd > ind.macdSignal ? 1 : -1;
    score += dir * WEIGHTS.macd * 0.7;
    reasons.push(dir > 0 ? "MACD 시그널선 위 — 상승 모멘텀" : "MACD 시그널선 아래 — 하락 모멘텀");
  }

  // 4) 볼린저밴드
  if (ind.touchedLower) {
    score += WEIGHTS.bollinger;
    reasons.push("볼린저밴드 하단 터치(반등 기대)");
  } else if (ind.touchedUpper) {
    score -= WEIGHTS.bollinger;
    reasons.push("볼린저밴드 상단 도달(과열)");
  }

  // -100 ~ +100 클램프
  score = Math.max(-100, Math.min(100, score));
  return { score, reasons };
}

// 초딩 버전 설명 — 등급 + 핵심 지표를 쉬운 말로
export function kidExplain(type: SignalType, ind: IndicatorSnapshot): string {
  const head: Record<SignalType, string> = {
    STRONG_BUY: "📈 지금 사기 좋은 신호가 아주 강해요!",
    BUY: "🙂 사도 괜찮아 보이는 신호예요.",
    HOLD: "😐 지금은 기다리는 게 좋아요. 오를지 내릴지 아직 헷갈려요.",
    SELL: "🙁 팔까 고민해볼 신호예요.",
    STRONG_SELL: "📉 위험 신호가 강해요. 조심하세요!",
  };
  const bits: string[] = [];
  if (ind.goldenCross) bits.push("최근 주가에 '오르기 시작' 표시가 떴어요(골든크로스).");
  else if (ind.deadCross) bits.push("최근 주가에 '내려가기 시작' 표시가 떴어요(데드크로스).");
  else if (ind.maShort != null && ind.maLong != null)
    bits.push(ind.maShort > ind.maLong ? "요즘 가격이 위로 가는 흐름이에요." : "요즘 가격이 아래로 가는 흐름이에요.");
  if (ind.rsi != null) {
    if (ind.rsi <= 30) bits.push("너무 많이 떨어져서 다시 튀어 오를 수 있어요.");
    else if (ind.rsi >= 70) bits.push("너무 많이 올라서 잠깐 쉴 수도 있어요.");
    else if (ind.rsi >= 55) bits.push("사는 사람이 좀 더 많은 편이에요.");
    else if (ind.rsi <= 45) bits.push("파는 사람이 좀 더 많은 편이에요.");
  }
  return `${head[type]} ${bits.join(" ")}`.trim();
}

export function gradeFromScore(score: number, risk: RiskProfile): SignalType {
  const t = THRESHOLDS[risk];
  if (score >= t.strong) return "STRONG_BUY";
  if (score >= t.buy) return "BUY";
  if (score <= -t.strong) return "STRONG_SELL";
  if (score <= -t.buy) return "SELL";
  return "HOLD";
}

export function generateSignal(
  symbol: string,
  candles: Candle[],
  risk: RiskProfile = "중립"
): SignalResult | null {
  if (candles.length < 60) return null; // 지표 계산에 충분한 데이터 필요
  const indicators = computeIndicators(candles);
  const { score, reasons } = scoreFromIndicators(indicators);
  const type = gradeFromScore(score, risk);
  const price = candles[candles.length - 1].close;

  return {
    symbol,
    type,
    score: Math.round(score),
    price,
    indicators,
    reasons,
    kid: kidExplain(type, indicators),
  };
}

// 등급 → 한글 라벨 + 색 (UI/알림 공용)
export const SIGNAL_LABEL: Record<SignalType, { ko: string; tone: string }> = {
  STRONG_BUY: { ko: "강한 매수", tone: "success" },
  BUY: { ko: "매수", tone: "success" },
  HOLD: { ko: "관망", tone: "warning" },
  SELL: { ko: "매도", tone: "danger" },
  STRONG_SELL: { ko: "강한 매도", tone: "danger" },
};
