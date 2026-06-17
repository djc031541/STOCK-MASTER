import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/datasources/yahoo";
import { backtest } from "@/lib/backtest";
import { getCurrentUser } from "@/lib/user";
import type { RiskProfile } from "@/lib/types";

// GET /api/backtest?symbol=NVDA&risk=중립&range=2y
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim();
  const range = searchParams.get("range") || "2y";
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol 필요" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const risk =
    (searchParams.get("risk") as RiskProfile) ||
    (user.riskProfile as RiskProfile) ||
    "중립";

  try {
    const candles = await getCandles(symbol, range, "1d");
    const result = backtest(symbol, candles, risk);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "데이터가 부족합니다" },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
