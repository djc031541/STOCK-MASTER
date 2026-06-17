// 모니터링 대상 심볼 모음 (Yahoo Finance 심볼 기준)

export type MarketIndex = {
  symbol: string;
  label: string;
  region: string;
};

// 세계 주요 지수 + 환율 (대시보드 "세계 증시" 카드)
export const WORLD_INDICES: MarketIndex[] = [
  { symbol: "^GSPC", label: "S&P 500", region: "US" },
  { symbol: "^IXIC", label: "나스닥", region: "US" },
  { symbol: "^DJI", label: "다우", region: "US" },
  { symbol: "^KS11", label: "코스피", region: "KR" },
  { symbol: "^KQ11", label: "코스닥", region: "KR" },
  { symbol: "^N225", label: "닛케이225", region: "JP" },
  { symbol: "^HSI", label: "항셍", region: "HK" },
  { symbol: "KRW=X", label: "USD/KRW", region: "FX" },
];

// 데모용 기본 워치리스트 (시드 데이터)
export const DEFAULT_WATCHLIST = [
  { symbol: "NVDA", market: "US" },
  { symbol: "AAPL", market: "US" },
  { symbol: "TSLA", market: "US" },
  { symbol: "005930.KS", market: "KR" }, // 삼성전자
];

// 국가(시장) 메타데이터 — 그룹핑/표시용
export const MARKET_META: Record<string, { label: string; flag: string; order: number }> = {
  US: { label: "미국", flag: "🇺🇸", order: 1 },
  KR: { label: "한국", flag: "🇰🇷", order: 2 },
  JP: { label: "일본", flag: "🇯🇵", order: 3 },
  HK: { label: "홍콩", flag: "🇭🇰", order: 4 },
  CN: { label: "중국", flag: "🇨🇳", order: 5 },
  UK: { label: "영국", flag: "🇬🇧", order: 6 },
  ETC: { label: "기타", flag: "🌐", order: 9 },
};

// 심볼 접미사로 시장 분류 (Yahoo 심볼 규칙 기준)
export function classifyMarket(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith(".KS") || s.endsWith(".KQ")) return "KR";
  if (s.endsWith(".T")) return "JP";
  if (s.endsWith(".HK")) return "HK";
  if (s.endsWith(".SS") || s.endsWith(".SZ")) return "CN";
  if (s.endsWith(".L")) return "UK";
  return "US";
}

// 외부 모니터링 사이트 링크 (구글 파이낸스 / Investing / Yahoo)
export function externalLinks(symbol: string) {
  const bare = symbol.split(".")[0]; // 접미사 제거
  return {
    google: `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}`,
    investing: `https://www.investing.com/search/?q=${encodeURIComponent(bare)}`,
    yahoo: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
  };
}
