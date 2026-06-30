// 종목별 최신 뉴스 감성분석 — 헤드라인의 호재/악재 키워드로 점수화.
// 차트(기술적) 분석에 더해 '뉴스'를 신호에 반영하기 위함. 30분 메모리 캐시.

import { fetchNews, type NewsItem } from "@/lib/datasources/news";

const POS = [
  "상승","급등","강세","호재","신고가","최고가","돌파","수주","흑자","성장","개선","호실적",
  "서프라이즈","상향","반등","회복","신제품","호황","역대급","대박","수출","계약","투자유치","목표가 상향",
  "surge","jump","rally","gain","beat","upgrade","record","soar","bullish","growth","profit","high",
];
const NEG = [
  "하락","급락","약세","악재","적자","손실","부진","하향","감소","우려","리콜","소송","규제","조사",
  "폭락","위기","둔화","경고","파산","감원","구조조정","유상증자","횡령","불성실","목표가 하향","쇼크",
  "fall","drop","plunge","loss","miss","downgrade","cut","lawsuit","probe","bearish","decline","warn","slump","low",
];

export type StockSentiment = {
  contribution: number; // 신호 점수에 더할 값 (-20 ~ +20)
  label: "긍정" | "중립" | "부정";
  pos: number;
  neg: number;
  headlines: { title: string; link: string; source: string; favicon: string }[];
  kid: string; // 초딩용 뉴스 한 줄
};

const cache = new Map<string, { at: number; data: StockSentiment }>();
const TTL = 30 * 60 * 1000;

function scoreText(t: string): { p: number; n: number } {
  let p = 0, n = 0;
  for (const w of POS) if (t.includes(w)) p++;
  for (const w of NEG) if (t.includes(w)) n++;
  return { p, n };
}

export function scoreHeadline(title: string): {
  label: "호재" | "중립" | "악재";
  impact: number;
  reason: string;
} {
  const { p, n } = scoreText(title);
  const net = p - n;
  const impact = Math.max(-10, Math.min(10, net * 3));
  return {
    label: net > 0 ? "호재" : net < 0 ? "악재" : "중립",
    impact,
    reason:
      net > 0
        ? "긍정 키워드가 더 많이 감지됨"
        : net < 0
          ? "부정 키워드가 더 많이 감지됨"
          : "강한 방향성 키워드가 제한적",
  };
}

export async function fetchSentiment(symbol: string, name: string): Promise<StockSentiment> {
  const key = symbol;
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL) return c.data;

  let news: NewsItem[] = [];
  try {
    news = await fetchNews(`${name} 주가`, 5);
  } catch {
    news = [];
  }

  let pos = 0, neg = 0;
  for (const it of news) {
    const { p, n } = scoreText(it.title);
    pos += p;
    neg += n;
  }
  const net = pos - neg;
  // -20 ~ +20 로 환산 (헤드라인 키워드 1개당 약 6점, 클램프)
  const contribution = Math.max(-20, Math.min(20, net * 6));
  const label: StockSentiment["label"] = net > 0 ? "긍정" : net < 0 ? "부정" : "중립";

  const kid =
    label === "긍정"
      ? "📰 요즘 뉴스에 좋은 소식이 더 많아요!"
      : label === "부정"
      ? "📰 요즘 뉴스에 걱정되는 소식이 좀 있어요."
      : "📰 요즘 뉴스는 특별히 좋지도 나쁘지도 않아요.";

  const data: StockSentiment = {
    contribution,
    label,
    pos,
    neg,
    headlines: news.slice(0, 4).map((n) => ({ ...scoreHeadline(n.title), title: n.title, link: n.link, source: n.source, favicon: n.favicon })),
    kid,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
