import { NextRequest, NextResponse } from "next/server";
import { buildBriefing, buildMarketRadar } from "@/lib/insights";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import type { RiskProfile } from "@/lib/types";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = (searchParams.get("market") || "US").toUpperCase();
  const user = await getCurrentUser();
  const risk = (searchParams.get("risk") as RiskProfile) || (user.riskProfile as RiskProfile) || "중립";
  const watch = await prisma.watchlist.findMany({ where: { userId: user.id } });
  const symbols = watch.length ? watch.map((w) => w.symbol) : ["NVDA", "AAPL", "JPM", "AMD", "GOOGL"];
  const [briefing, radar] = await Promise.all([buildBriefing(symbols, risk, market), buildMarketRadar(market)]);

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><title>STOCK MASTER REPORT</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#081018;color:#eef1f7;margin:0;padding:32px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border-bottom:1px solid #263244;padding:10px;text-align:left}th{color:#8fb3ff}.box{border:1px solid #263244;border-radius:14px;padding:18px;margin:14px 0;background:#111827}.up{color:#28e39f}.down{color:#ff6378}</style></head>
  <body><h1>STOCK MASTER 고급 투자 리포트</h1><p>${esc(new Date().toLocaleString("ko-KR"))} · 리스크 ${esc(risk)} · 시장 ${esc(market)}</p>
  <div class="box"><h2>시장 분위기</h2><p>${esc(briefing.mood)} · 지수 평균 ${briefing.indexAvg.toFixed(2)}%</p><ul>${briefing.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>
  <h2>오늘 봐야 할 종목</h2><table><thead><tr><th>종목</th><th>점수</th><th>RSI</th><th>뉴스</th><th>목표가</th><th>손절가</th><th>백테스트</th></tr></thead><tbody>
  ${briefing.focus.map((s) => `<tr><td>${esc(s.name)} (${esc(s.symbol)})</td><td>${s.score}</td><td>${s.rsi?.toFixed(0) ?? "-"}</td><td>${esc(s.newsLabel)} ${s.newsScore >= 0 ? "+" : ""}${s.newsScore}</td><td>${s.levels.target.toLocaleString("ko-KR")}</td><td>${s.levels.stop.toLocaleString("ko-KR")}</td><td>${s.backtest ? `${s.backtest.winRate.toFixed(0)}% 승률 / MDD ${s.backtest.maxDrawdownPct.toFixed(1)}%` : "-"}</td></tr>`).join("")}
  </tbody></table>
  <h2>시장 레이더</h2><table><thead><tr><th>종목</th><th>등락</th><th>거래량</th><th>분류</th></tr></thead><tbody>
  ${radar.movers.map((r) => `<tr><td>${esc(r.name)} (${esc(r.symbol)})</td><td class="${r.changePercent >= 0 ? "up" : "down"}">${r.changePercent.toFixed(2)}%</td><td>${r.volumeRatio.toFixed(1)}x</td><td>${esc(r.divergence)}</td></tr>`).join("")}
  </tbody></table><p>※ 투자 참고용입니다. 최종 판단과 책임은 사용자에게 있습니다.</p></body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="stock-master-report-${market}.html"`,
    },
  });
}
