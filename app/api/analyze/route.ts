import { NextRequest, NextResponse } from "next/server";
import { analyzeSymbol } from "@/lib/insights";
import { getCurrentUser } from "@/lib/user";
import type { RiskProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol 필요" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const risk =
    (searchParams.get("risk") as RiskProfile) ||
    (user.riskProfile as RiskProfile) ||
    "중립";

  try {
    const data = await analyzeSymbol(symbol, risk);
    if (!data) {
      return NextResponse.json({ ok: false, error: "분석 가능한 데이터가 부족합니다." }, { status: 422 });
    }
    return NextResponse.json({ ok: true, risk, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
