import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/datasources/yahoo";
import { generateSignal, SIGNAL_LABEL } from "@/lib/signal";
import { getCurrentUser } from "@/lib/user";
import { UNIVERSE } from "@/lib/universe";
import type { RiskProfile } from "@/lib/types";

// GET /api/recommend?market=US&risk=중립
// 해당 국가 유니버스를 신호 스캔 → 점수 높은 순으로 추천.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = (searchParams.get("market") || "US").toUpperCase();
  const list = UNIVERSE[market];
  if (!list) {
    return NextResponse.json({ ok: false, error: "지원하지 않는 국가" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const risk =
    (searchParams.get("risk") as RiskProfile) || (user.riskProfile as RiskProfile) || "중립";

  const nameMap = new Map(list.map((x) => [x.symbol, x.name]));

  const settled = await Promise.allSettled(
    list.map(async (x) => {
      const candles = await getCandles(x.symbol, "1y", "1d");
      return generateSignal(x.symbol, candles, risk);
    })
  );

  const rows = settled
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof generateSignal>> => r.status === "fulfilled" && r.value !== null)
    .map((r) => {
      const s = r.value!;
      return {
        symbol: s.symbol,
        name: nameMap.get(s.symbol) ?? s.symbol,
        type: s.type,
        label: SIGNAL_LABEL[s.type].ko,
        tone: SIGNAL_LABEL[s.type].tone,
        score: s.score,
        price: s.price,
        rsi: s.indicators.rsi,
        reasons: s.reasons,
      };
    })
    // 매수 우호 순(점수 내림차순)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ ok: true, market, risk, data: rows });
}
