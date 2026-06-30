import { NextRequest, NextResponse } from "next/server";
import { analyzeSymbol } from "@/lib/insights";
import { getCurrentUser } from "@/lib/user";
import type { RiskProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") || "NVDA,AMD,AVGO")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 6);
  const user = await getCurrentUser();
  const risk =
    (searchParams.get("risk") as RiskProfile) ||
    (user.riskProfile as RiskProfile) ||
    "중립";

  const settled = await Promise.allSettled(symbols.map((s) => analyzeSymbol(s, risk)));
  const data = settled
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof analyzeSymbol>>>> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  return NextResponse.json({ ok: true, risk, symbols, data });
}
