// 포트폴리오 평가손익 계산 — 보유종목 평균단가 vs 실시간 시세
// 통화 혼재(USD 종목 + KRW 종목)는 환율로 기준통화(KRW)로 환산한다.

import { getQuote } from "@/lib/datasources/yahoo";

export type HoldingInput = {
  symbol: string;
  market: string;
  qty: number;
  avgBuyPrice: number;
};

export type HoldingValuation = HoldingInput & {
  id?: string;
  price: number; // 현재가 (종목 통화)
  currency: string;
  marketValue: number; // 평가금액 (기준통화 KRW)
  costBasis: number; // 매입금액 (기준통화 KRW)
  pnl: number; // 평가손익 (KRW)
  pnlPercent: number;
};

export type PortfolioSummary = {
  baseCurrency: string;
  seedAmount: number;
  cashBalance: number;
  holdingsValue: number; // 보유종목 평가금액 합 (KRW)
  totalValue: number; // 현금 + 평가금액
  totalCost: number; // 매입원가 합 (KRW)
  totalPnl: number; // 평가손익 합 (KRW)
  totalPnlPercent: number;
  holdings: HoldingValuation[];
};

// USD→KRW 환율 (Yahoo KRW=X). 실패 시 보수적 기본값.
async function getUsdKrw(): Promise<number> {
  try {
    const q = await getQuote("KRW=X");
    return q.price || 1350;
  } catch {
    return 1350;
  }
}

export async function valuatePortfolio(
  seedAmount: number,
  cashBalance: number,
  holdings: HoldingInput[],
  baseCurrency = "KRW"
): Promise<PortfolioSummary> {
  const usdKrw = await getUsdKrw();

  // 종목 통화 → 기준통화(KRW) 환산 계수
  const toKrw = (value: number, currency: string) =>
    currency === "KRW" ? value : value * usdKrw;

  const valued: HoldingValuation[] = [];
  for (const h of holdings) {
    let price = h.avgBuyPrice;
    let currency = h.market === "KR" ? "KRW" : "USD";
    try {
      const q = await getQuote(h.symbol);
      price = q.price;
      currency = q.currency;
    } catch {
      // 시세 실패 시 평단가로 대체 (손익 0 처리)
    }
    const marketValue = toKrw(price * h.qty, currency);
    const costBasis = toKrw(h.avgBuyPrice * h.qty, currency);
    const pnl = marketValue - costBasis;
    const pnlPercent = costBasis ? (pnl / costBasis) * 100 : 0;
    valued.push({
      ...h,
      price,
      currency,
      marketValue,
      costBasis,
      pnl,
      pnlPercent,
    });
  }

  const holdingsValue = valued.reduce((a, h) => a + h.marketValue, 0);
  const totalCost = valued.reduce((a, h) => a + h.costBasis, 0);
  const totalPnl = valued.reduce((a, h) => a + h.pnl, 0);
  const totalValue = cashBalance + holdingsValue;
  const totalPnlPercent = totalCost ? (totalPnl / totalCost) * 100 : 0;

  return {
    baseCurrency,
    seedAmount,
    cashBalance,
    holdingsValue,
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    holdings: valued,
  };
}
