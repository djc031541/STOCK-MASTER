import { NextRequest, NextResponse } from "next/server";
import { analyzeSymbol } from "@/lib/insights";
import { getCurrentUser } from "@/lib/user";
import type { RiskProfile } from "@/lib/types";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ ok: false, error: "symbol 필요" }, { status: 400 });

  const user = await getCurrentUser();
  const risk = (searchParams.get("risk") as RiskProfile) || (user.riskProfile as RiskProfile) || "중립";
  const s = await analyzeSymbol(symbol, risk);
  if (!s) return NextResponse.json({ ok: false, error: "분석 가능한 데이터가 부족합니다." }, { status: 422 });

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><title>${esc(s.symbol)} 분석 리포트</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#081018;color:#eef1f7;margin:0;padding:32px;line-height:1.55}.box{border:1px solid #263244;border-radius:14px;padding:18px;margin:14px 0;background:#111827}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #263244;padding:10px;text-align:left}th{color:#8fb3ff}.up{color:#28e39f}.down{color:#ff6378}.badge{display:inline-block;border-radius:999px;padding:5px 10px;background:#173526;color:#28e39f;font-weight:700}</style></head>
  <body><h1>${esc(s.name)} (${esc(s.symbol)}) 분석 리포트</h1><p>${esc(new Date().toLocaleString("ko-KR"))} · ${esc(s.market)} · ${esc(s.sector)} · 리스크 ${esc(risk)}</p>
  <div class="box"><h2>종합 판단 <span class="badge">${esc(s.label)}</span></h2><p>종합 ${s.score}점 · 기술 ${s.techScore}점 · 뉴스 ${s.newsScore >= 0 ? "+" : ""}${s.newsScore}점(${esc(s.newsLabel)})</p></div>
  <table><tbody>
  <tr><th>현재가</th><td>${s.price.toLocaleString("ko-KR")}</td><th>RSI</th><td>${s.rsi?.toFixed(0) ?? "-"}</td></tr>
  <tr><th>추세</th><td>${esc(s.trend)}</td><th>연율 변동성</th><td>${s.volatility.toFixed(1)}%</td></tr>
  <tr><th>목표가</th><td class="up">${s.levels.target.toLocaleString("ko-KR")} (+${s.levels.targetPct.toFixed(1)}%)</td><th>손절가</th><td class="down">${s.levels.stop.toLocaleString("ko-KR")} (${s.levels.stopPct.toFixed(1)}%)</td></tr>
  <tr><th>백테스트</th><td colspan="3">${s.backtest ? `승률 ${s.backtest.winRate.toFixed(0)}%, 전략 ${s.backtest.strategyReturnPct.toFixed(1)}%, MDD ${s.backtest.maxDrawdownPct.toFixed(1)}%` : "데이터 부족"}</td></tr>
  </tbody></table>
  <div class="box"><h2>분석 이유</h2><ul>${s.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>
  <div class="box"><h2>뉴스 영향도</h2><ul>${s.news.map((n) => `<li><b>${esc(n.label ?? "중립")} ${n.impact ?? 0}</b> - ${esc(n.title)} <small>${esc(n.source)}</small></li>`).join("") || "<li>뉴스 데이터 없음</li>"}</ul></div>
  <p>※ 투자 참고용입니다. 최종 판단과 책임은 사용자에게 있습니다.</p></body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${symbol}-analysis-report.html"`,
    },
  });
}
