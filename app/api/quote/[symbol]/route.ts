import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/datasources/yahoo";

// GET /api/quote/:symbol — 개별 종목 현재 시세
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  try {
    const quote = await getQuote(decodeURIComponent(symbol));
    return NextResponse.json({ ok: true, data: quote });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
