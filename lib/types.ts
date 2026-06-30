// 공용 타입 정의

export type Candle = {
  date: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number; // 절대 변화
  changePercent: number; // % 변화
  currency: string;
};

export type SignalType =
  | "STRONG_BUY"
  | "BUY"
  | "HOLD"
  | "SELL"
  | "STRONG_SELL";

export type IndicatorSnapshot = {
  rsi: number | null;
  maShort: number | null; // 단기 이동평균
  maLong: number | null; // 장기 이동평균
  goldenCross: boolean;
  deadCross: boolean;
  macd: number | null;
  macdSignal: number | null;
  macdCrossUp: boolean;
  macdCrossDown: boolean;
  bollUpper: number | null;
  bollLower: number | null;
  touchedLower: boolean;
  touchedUpper: boolean;
};

export type SignalResult = {
  symbol: string;
  type: SignalType;
  score: number; // -100 ~ +100
  price: number;
  indicators: IndicatorSnapshot;
  reasons: string[]; // 사람이 읽을 근거
  kid: string; // 초딩 버전 쉬운 설명
};

export type RiskProfile = "안정" | "중립" | "공격";
