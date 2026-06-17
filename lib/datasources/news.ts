// 뉴스 수집 — 무료/키없이 시작.
//   기본: Google News RSS (한국어, 키 불필요)
//   NAVER_CLIENT_ID/SECRET 가 있으면 네이버 뉴스 검색 API 사용.
// Yahoo와 동일하게 시스템 curl 로 호출(undici 차단·일관성 회피).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  sourceUrl: string;
  favicon: string; // 출처 도메인 favicon(이미지)
  pubDate: string;
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function faviconOf(url: string): string {
  const d = domainOf(url);
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=64` : "";
}

async function curlGet(url: string, headers: string[] = []): Promise<string> {
  const args = ["-s", "--max-time", "15", "-A", UA];
  for (const h of headers) args.push("-H", h);
  args.push(url);
  const { stdout } = await execFileAsync("curl", args, {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// Google News RSS (키 불필요)
async function fetchGoogleNews(query: string, limit: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query
  )}&hl=ko&gl=KR&ceid=KR:ko`;
  const xml = await curlGet(url);
  const items: NewsItem[] = [];
  const blocks = xml.split("<item>").slice(1);
  for (const b of blocks.slice(0, limit)) {
    const title = b.match(/<title>(.*?)<\/title>/s)?.[1] ?? "";
    const link = b.match(/<link>(.*?)<\/link>/s)?.[1] ?? "";
    const pub = b.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1] ?? "";
    const source = b.match(/<source[^>]*>(.*?)<\/source>/s)?.[1] ?? "";
    const srcUrl = b.match(/<source url="(.*?)"/s)?.[1] ?? "";
    items.push({
      title: decode(title),
      link: decode(link),
      source: decode(source),
      sourceUrl: srcUrl,
      favicon: faviconOf(srcUrl),
      pubDate: decode(pub),
    });
  }
  return items;
}

// 네이버 뉴스 검색 API (키 필요)
async function fetchNaverNews(query: string, limit: number): Promise<NewsItem[]> {
  const id = process.env.NAVER_CLIENT_ID!;
  const secret = process.env.NAVER_CLIENT_SECRET!;
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
    query
  )}&display=${limit}&sort=date`;
  const raw = await curlGet(url, [
    `X-Naver-Client-Id: ${id}`,
    `X-Naver-Client-Secret: ${secret}`,
  ]);
  const json = JSON.parse(raw) as {
    items?: { title: string; originallink: string; pubDate: string }[];
  };
  return (json.items ?? []).map((i) => ({
    title: decode(i.title),
    link: i.originallink,
    source: domainOf(i.originallink) || "naver",
    sourceUrl: i.originallink,
    favicon: faviconOf(i.originallink),
    pubDate: i.pubDate,
  }));
}

export async function fetchNews(query: string, limit = 5): Promise<NewsItem[]> {
  try {
    if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
      return await fetchNaverNews(query, limit);
    }
    return await fetchGoogleNews(query, limit);
  } catch {
    return [];
  }
}
