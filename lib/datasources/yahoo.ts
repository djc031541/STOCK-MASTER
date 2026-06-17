// Yahoo Finance 공개 차트 API — API 키 불필요 (무료)
// 전 세계 지수/주식/환율/암호화폐를 모두 커버한다.
//
//   심볼 예시:
//     ^GSPC  = S&P 500,  ^IXIC = 나스닥,  ^DJI = 다우
//     ^KS11  = 코스피,    ^KQ11 = 코스닥,  ^N225 = 닛케이
//     AAPL, NVDA, TSLA   = 미국 개별주
//     005930.KS          = 삼성전자 (한국)
//     KRW=X              = USD/KRW 환율,  BTC-USD = 비트코인

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readCache, writeCache } from "@/lib/cache";
import type { Candle, Quote } from "@/lib/types";

const execFileAsync = promisify(execFile);

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// 주의: 긴 Chrome UA 문자열은 Yahoo가 429로 차단한다. 짧은 UA를 사용한다.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

// 참고: Yahoo는 Node(undici)의 fetch를 TLS 지문 기반으로 429 차단한다.
// 시스템 curl은 정상 통과하므로 curl로 받아온다(맥/리눅스 기본 설치).
// 클라우드 배포 시에는 Finnhub/KIS 등 키 기반 소스로 교체 예정.

type ChartResponse = {
  chart: {
    result:
      | {
          meta: {
            symbol: string;
            regularMarketPrice: number;
            chartPreviousClose?: number;
            previousClose?: number;
            currency: string;
            shortName?: string;
            longName?: string;
          };
          timestamp?: number[];
          indicators: {
            quote: {
              open: (number | null)[];
              high: (number | null)[];
              low: (number | null)[];
              close: (number | null)[];
              volume: (number | null)[];
            }[];
          };
        }[]
      | null;
    error: unknown;
  };
};

// 간단한 메모리 캐시 (60초) — 호출량 절약
const cache = new Map<string, { at: number; data: ChartResponse }>();
const TTL = 60_000;
const DB_TTL = 5 * 60_000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function curlJson(url: string, symbol: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { stdout } = await execFileAsync(
        "curl",
        [
          "-sS",
          "--fail",
          "--retry",
          "1",
          "--max-time",
          "15",
          "-A",
          UA,
          "-H",
          "Accept: application/json",
          url,
        ],
        { maxBuffer: 10 * 1024 * 1024 }
      );
      return stdout;
    } catch (e) {
      lastError = e as Error;
      await wait(250 * (attempt + 1));
    }
  }
  throw new Error(`Yahoo 호출 실패 (${symbol}): ${lastError?.message ?? "unknown"}`);
}

async function fetchChart(
  symbol: string,
  range: string,
  interval: string
): Promise<ChartResponse> {
  const url = `${BASE}/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=false`;

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < TTL) return cached.data;

  const dbKey = `yahoo:${symbol}:${range}:${interval}`;
  const dbCached = await readCache<ChartResponse>(dbKey);
  if (dbCached) {
    cache.set(url, { at: Date.now(), data: dbCached });
    return dbCached;
  }

  // curl로 호출 (Node fetch는 Yahoo가 429로 막음)
  const stdout = await curlJson(url, symbol);

  let parsed: ChartResponse;
  try {
    parsed = JSON.parse(stdout) as ChartResponse;
  } catch {
    throw new Error(`Yahoo 응답 파싱 실패 (${symbol})`);
  }
  if (!parsed?.chart?.result) {
    throw new Error(`Yahoo 데이터 없음 (${symbol})`);
  }

  cache.set(url, { at: Date.now(), data: parsed });
  await writeCache(dbKey, parsed, DB_TTL);
  return parsed;
}

// 현재 시세 (지수 카드/워치리스트용)
export async function getQuote(symbol: string): Promise<Quote> {
  const data = await fetchChart(symbol, "5d", "1d");
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`데이터 없음: ${symbol}`);

  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const prevClose =
    meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;

  return {
    // 요청한 심볼을 그대로 반환 (Yahoo가 KRW=X→USDKRW=X 처럼 바꿔도 라벨 매핑 유지)
    symbol,
    name: meta.shortName ?? meta.longName ?? meta.symbol,
    price,
    prevClose,
    change,
    changePercent,
    currency: meta.currency ?? "USD",
  };
}

// 일봉 캔들 (지표 계산/차트/백테스팅용). 기본 6개월.
export async function getCandles(
  symbol: string,
  range = "6mo",
  interval = "1d"
): Promise<Candle[]> {
  const data = await fetchChart(symbol, range, interval);
  const result = data.chart.result?.[0];
  if (!result || !result.timestamp) return [];

  const ts = result.timestamp;
  const q = result.indicators.quote[0];

  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close[i];
    // 휴장 등으로 null인 구간은 건너뛴다
    if (close == null) continue;
    candles.push({
      date: ts[i],
      open: q.open[i] ?? close,
      high: q.high[i] ?? close,
      low: q.low[i] ?? close,
      close,
      volume: q.volume[i] ?? 0,
    });
  }
  return candles;
}

// 여러 심볼 시세를 한 번에 (실패한 건 건너뜀)
export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const settled = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}
