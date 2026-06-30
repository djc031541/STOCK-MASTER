// 초딩 버전 설명 — 실제 숫자/근거가 들어간 구체적 설명을 만든다.
// (얼렁뚱땅 일반론이 아니라, 이 종목의 실제 값으로 설명)

import type { IndicatorSnapshot, SignalType } from "@/lib/types";

const GRADE_KO: Record<SignalType, string> = {
  STRONG_BUY: "강한 매수",
  BUY: "매수",
  HOLD: "관망",
  SELL: "매도",
  STRONG_SELL: "강한 매도",
};

export type KidExplain = {
  headline: string;
  points: string[];
  caveat: string;
};

export function buildKid(
  name: string,
  type: SignalType,
  score: number,
  ind: IndicatorSnapshot,
  price: number,
  market: string,
  senti: { pos: number; neg: number; label: string }
): KidExplain {
  const priceStr =
    market === "KR"
      ? `${Math.round(price).toLocaleString("ko-KR")}원`
      : `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  const points: string[] = [];
  points.push(`지금 ${name} 1주 가격은 ${priceStr} 정도예요.`);

  // 1) 추세 (이동평균 / 크로스)
  if (ind.goldenCross) {
    points.push("최근에 '이제부터 오를 수 있어요' 신호(골든크로스)가 떴어요. 짧은 평균선이 긴 평균선을 위로 뚫었거든요.");
  } else if (ind.deadCross) {
    points.push("최근에 '조심' 신호(데드크로스)가 떴어요. 짧은 평균선이 긴 평균선을 아래로 뚫었거든요.");
  } else if (ind.maShort != null && ind.maLong != null) {
    const gap = ((ind.maShort - ind.maLong) / ind.maLong) * 100;
    if (ind.maShort > ind.maLong)
      points.push(`최근 20일 평균값보다 지금 가격이 ${Math.abs(gap).toFixed(1)}% 높아요 → '오르는 흐름'이라는 뜻이에요.`);
    else
      points.push(`최근 20일 평균값보다 지금 가격이 ${Math.abs(gap).toFixed(1)}% 낮아요 → '내리는 흐름'이라는 뜻이에요.`);
  }

  // 2) RSI (얼마나 달아올랐나)
  if (ind.rsi != null) {
    const r = Math.round(ind.rsi);
    let meaning: string;
    if (r >= 70) meaning = "너무 많이 올라서 잠깐 쉬어갈 수 있다는 뜻이에요";
    else if (r <= 30) meaning = "너무 많이 떨어져서 다시 오를 힘이 생길 수 있다는 뜻이에요";
    else if (r >= 55) meaning = "사는 사람이 조금 더 많다는 뜻이에요";
    else if (r <= 45) meaning = "파는 사람이 조금 더 많다는 뜻이에요";
    else meaning = "딱 중간이라 아직 부담이 적다는 뜻이에요";
    points.push(`'얼마나 달아올랐나' 점수(RSI)는 ${r}점이에요. 0이면 너무 싸고 100이면 너무 비싼데, ${r}점은 ${meaning}.`);
  }

  // 3) MACD (힘의 방향)
  if (ind.macdCrossUp) points.push("주가에 힘이 막 붙기 시작했어요(MACD가 위로 돌아섰어요).");
  else if (ind.macdCrossDown) points.push("주가의 힘이 막 빠지기 시작했어요(MACD가 아래로 돌아섰어요).");

  // 4) 뉴스
  const total = senti.pos + senti.neg;
  if (total > 0)
    points.push(`최근 뉴스에서 좋은 소식 ${senti.pos}개, 나쁜 소식 ${senti.neg}개를 찾았어요. 그래서 분위기는 '${senti.label}'이에요.`);
  else
    points.push("최근 뉴스에는 크게 좋거나 나쁜 소식이 없었어요.");

  const headline = `${name}는 지금 '${GRADE_KO[type]}' 신호예요. 쉬운 점수로 ${Math.round(score)}점이에요 (−100~+100 중에).`;
  const caveat =
    type === "HOLD"
      ? "오를지 내릴지 아직 분명하지 않으니, 조금 더 지켜보는 게 좋아요. 그리고 주식은 참고만 하세요!"
      : "그래도 주식은 언제든 반대로 갈 수 있으니, 이건 '힌트'일 뿐 꼭 '참고'만 하세요!";

  return { headline, points, caveat };
}
