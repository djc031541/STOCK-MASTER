// 일일 뉴스 브리핑 조립 → DB 저장
//   구성: 간밤 세계증시 마감 + 경제뉴스 AI요약 + 관심종목 뉴스

import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/datasources/yahoo";
import { fetchNews } from "@/lib/datasources/news";
import { summarizeNews } from "@/lib/summarize";
import { WORLD_INDICES } from "@/lib/markets";

function todayKey(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export async function buildDailyBrief(watchSymbols: string[] = []) {
  const date = todayKey();
  const dateStr = date.toISOString().slice(0, 10);

  // 1) 세계증시 마감
  const quotes = await getQuotes(WORLD_INDICES.map((i) => i.symbol));
  const labelMap = new Map(WORLD_INDICES.map((i) => [i.symbol, i.label]));
  const marketLines = quotes.map((q) => {
    const sign = q.changePercent >= 0 ? "▲" : "▼";
    return `- ${labelMap.get(q.symbol) ?? q.symbol}: ${q.price.toLocaleString(
      "ko-KR"
    )} (${sign}${Math.abs(q.changePercent).toFixed(2)}%)`;
  });

  // 2) 경제 뉴스 + 요약(일반/초딩)
  const econNews = await fetchNews("증시 경제 금리", 6);
  const { summary, kid, usedAI } = await summarizeNews(econNews);

  // 3) 관심종목 관련 뉴스 (최대 2종목)
  const watchNews: typeof econNews = [];
  for (const sym of watchSymbols.slice(0, 2)) {
    const news = await fetchNews(`${sym} 주가`, 2);
    watchNews.push(...news);
  }

  // 본문 마크다운 (세계증시 + 요약)
  const contentMd = [
    `# 📰 ${dateStr} 모닝 브리핑`,
    ``,
    `## 🌙 간밤 세계증시`,
    ...marketLines,
    ``,
    `## 📊 경제 핵심 ${usedAI ? "(AI 요약)" : ""}`,
    summary,
  ].join("\n");

  // 초딩 버전 마크다운
  const kidMd = `## 🧒 초등학생 버전\n${kid}`;

  // 구조화 기사(이미지+링크용)
  const items = [...econNews.slice(0, 6), ...watchNews].map((n) => ({
    title: n.title,
    link: n.link,
    source: n.source,
    favicon: n.favicon,
  }));

  const oneLine = econNews[0]?.title ?? marketLines[0] ?? "오늘의 시장 브리핑";

  const brief = await prisma.newsBrief.upsert({
    where: { date },
    update: { contentMd, summary: oneLine, kidMd, itemsJson: JSON.stringify(items) },
    create: { date, contentMd, summary: oneLine, kidMd, itemsJson: JSON.stringify(items) },
  });

  return brief;
}

export async function getLatestBrief() {
  return prisma.newsBrief.findFirst({ orderBy: { date: "desc" } });
}
