// 국가별 추천 후보 유니버스 (대표 대형주). 추천 시 이 목록을 신호 스캔한다.
// 심볼은 Yahoo Finance 기준.

export const UNIVERSE: Record<string, { symbol: string; name: string }[]> = {
  US: [
    { symbol: "AAPL", name: "애플" },
    { symbol: "MSFT", name: "마이크로소프트" },
    { symbol: "NVDA", name: "엔비디아" },
    { symbol: "AMZN", name: "아마존" },
    { symbol: "GOOGL", name: "알파벳" },
    { symbol: "META", name: "메타" },
    { symbol: "TSLA", name: "테슬라" },
    { symbol: "AVGO", name: "브로드컴" },
    { symbol: "JPM", name: "JP모건" },
    { symbol: "AMD", name: "AMD" },
  ],
  KR: [
    { symbol: "005930.KS", name: "삼성전자" },
    { symbol: "000660.KS", name: "SK하이닉스" },
    { symbol: "373220.KS", name: "LG에너지솔루션" },
    { symbol: "207940.KS", name: "삼성바이오로직스" },
    { symbol: "005380.KS", name: "현대차" },
    { symbol: "035420.KS", name: "NAVER" },
    { symbol: "000270.KS", name: "기아" },
    { symbol: "035720.KS", name: "카카오" },
    { symbol: "051910.KS", name: "LG화학" },
    { symbol: "068270.KS", name: "셀트리온" },
  ],
  JP: [
    { symbol: "7203.T", name: "토요타" },
    { symbol: "6758.T", name: "소니" },
    { symbol: "9984.T", name: "소프트뱅크" },
    { symbol: "8035.T", name: "도쿄일렉트론" },
    { symbol: "6861.T", name: "키엔스" },
    { symbol: "9983.T", name: "패스트리테일링" },
  ],
  HK: [
    { symbol: "0700.HK", name: "텐센트" },
    { symbol: "9988.HK", name: "알리바바" },
    { symbol: "3690.HK", name: "메이퇀" },
    { symbol: "1810.HK", name: "샤오미" },
    { symbol: "9618.HK", name: "징둥" },
  ],
};

export const UNIVERSE_MARKETS = Object.keys(UNIVERSE);
