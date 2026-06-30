// 심볼 → 표시 이름(한글/통명) 사전. 없으면 심볼 그대로.

import { UNIVERSE } from "@/lib/universe";

const EXTRA: Record<string, string> = {
  // 한국 (유니버스 외 자주 보는 종목)
  "005490.KS": "POSCO홀딩스",
  "012330.KS": "현대모비스",
  "028260.KS": "삼성물산",
  "105560.KS": "KB금융",
  "055550.KS": "신한지주",
  "066570.KS": "LG전자",
  "003670.KS": "포스코퓨처엠",
  "096770.KS": "SK이노베이션",
  "017670.KS": "SK텔레콤",
  "015760.KS": "한국전력",
  "323410.KS": "카카오뱅크",
  "247540.KQ": "에코프로비엠",
  "086520.KQ": "에코프로",
  "091990.KQ": "셀트리온헬스케어",
  // 미국 (통명)
  "GOOG": "알파벳",
  "NFLX": "넷플릭스",
  "INTC": "인텔",
  "QCOM": "퀄컴",
  "ORCL": "오라클",
  "CRM": "세일즈포스",
  "DIS": "디즈니",
  "KO": "코카콜라",
  "V": "비자",
  "BAC": "뱅크오브아메리카",
};

// 유니버스의 모든 (symbol→name) 를 합쳐 사전 구성
const NAME_MAP: Record<string, string> = { ...EXTRA };
for (const list of Object.values(UNIVERSE)) {
  for (const x of list) NAME_MAP[x.symbol] = x.name;
}

export function displayName(symbol: string): string {
  return NAME_MAP[symbol.toUpperCase()] ?? NAME_MAP[symbol] ?? symbol;
}
