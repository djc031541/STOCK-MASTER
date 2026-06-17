"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MARKET_META, externalLinks } from "@/lib/markets";
import StockChart from "./StockChart";

type IndexRow = { symbol: string; label: string; price: number; changePercent: number; currency: string };
type Indic = {
  rsi: number | null; maTrend: string | null; goldenCross: boolean; deadCross: boolean;
  macdState: string | null; macdCrossUp: boolean; macdCrossDown: boolean; touchedLower: boolean; touchedUpper: boolean;
};
type SignalRow = { symbol: string; market: string; label: string; tone: string; type: string; score: number; price: number; rsi: number | null; reasons: string[]; indicators: Indic };
type WatchRow = { id: string; symbol: string; market: string; targetPrice: number | null; stopLoss: number | null };
type Holding = { id: string; symbol: string; market: string; qty: number; avgBuyPrice: number; price: number; currency: string; marketValue: number; pnl: number; pnlPercent: number };
type Portfolio = { seedAmount: number; cashBalance: number; totalValue: number; totalPnl: number; totalPnlPercent: number; holdings: Holding[] };
type NewsItem = { title: string; link: string; source: string; favicon: string };
type Brief = { date: string; contentMd: string; kidMd: string | null; itemsJson: string | null; summary: string } | null;
type Settings = { notifyEmail: boolean; notifyKakao: boolean; notifyPush: boolean };
type Rec = { symbol: string; name: string; label: string; tone: string; score: number; price: number; rsi: number | null; reasons: string[] };

const RISKS = ["안정", "중립", "공격"] as const;
const REC_MARKETS = ["US", "KR", "JP", "HK"] as const;
const POLL_SEC = 20;
function won(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }

export default function Dashboard() {
  const [risk, setRisk] = useState<(typeof RISKS)[number]>("중립");
  const [indices, setIndices] = useState<IndexRow[]>([]);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [watch, setWatch] = useState<WatchRow[]>([]);
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [brief, setBrief] = useState<Brief>(null);
  const [settings, setSettings] = useState<Settings>({ notifyEmail: true, notifyKakao: false, notifyPush: true });
  const [newSym, setNewSym] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState("");
  const [updated, setUpdated] = useState("");
  const [countdown, setCountdown] = useState(POLL_SEC);
  const [seedEdit, setSeedEdit] = useState<string>("");
  const [holdingForm, setHoldingForm] = useState({ symbol: "", market: "US", qty: "", avgBuyPrice: "" });
  const [holdingEdits, setHoldingEdits] = useState<Record<string, { qty: string; avgBuyPrice: string }>>({});
  const [kidMode, setKidMode] = useState(false);
  const [recMarket, setRecMarket] = useState<(typeof REC_MARKETS)[number]>("US");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [recBusy, setRecBusy] = useState(false);
  const [targetPct, setTargetPct] = useState<Record<string, string>>({});
  const riskRef = useRef(risk);
  riskRef.current = risk;

  const load = useCallback(async (silent = false) => {
    if (!silent) setBusy("load");
    try {
      const [i, s, w, p, b, st] = await Promise.all([
        fetch("/api/market/indices").then((r) => r.json()),
        fetch(`/api/signals?risk=${encodeURIComponent(riskRef.current)}`).then((r) => r.json()),
        fetch("/api/watchlist").then((r) => r.json()),
        fetch("/api/portfolio").then((r) => r.json()),
        fetch("/api/news/today").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ]);
      if (i.ok) setIndices(i.data);
      if (s.ok) setSignals(s.data);
      if (w.ok) setWatch(w.data);
      if (p.ok) { setPf(p.data); setSeedEdit(String(Math.round(p.data.seedAmount))); }
      if (b.ok) setBrief(b.data);
      if (st.ok) setSettings(st.data);
      setUpdated(new Date().toLocaleTimeString("ko-KR"));
      setCountdown(POLL_SEC);
    } finally {
      if (!silent) setBusy("");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!live) return;
    const tick = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { load(true); return POLL_SEC; } return c - 1; });
    }, 1000);
    return () => clearInterval(tick);
  }, [live, load]);

  async function changeRisk(r: (typeof RISKS)[number]) {
    setRisk(r);
    await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ riskProfile: r }) });
    load(true);
  }
  async function saveSeed() {
    const v = Number(seedEdit);
    if (!Number.isFinite(v) || v < 0) return;
    await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seedAmount: v }) });
    load(true);
  }
  async function addHolding() {
    const qty = Number(holdingForm.qty);
    const avgBuyPrice = Number(holdingForm.avgBuyPrice);
    const symbol = holdingForm.symbol.trim().toUpperCase();
    if (!symbol || !Number.isFinite(qty) || !Number.isFinite(avgBuyPrice) || qty <= 0 || avgBuyPrice < 0) return;
    await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...holdingForm, symbol, qty, avgBuyPrice }),
    });
    setHoldingForm({ symbol: "", market: "US", qty: "", avgBuyPrice: "" });
    load(true);
  }
  async function saveHolding(h: Holding) {
    const edit = holdingEdits[h.id];
    if (!edit) return;
    const qty = Number(edit.qty);
    const avgBuyPrice = Number(edit.avgBuyPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(avgBuyPrice) || qty <= 0 || avgBuyPrice < 0) return;
    await fetch(`/api/holdings/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty, avgBuyPrice }),
    });
    load(true);
  }
  async function removeHolding(id: string) {
    await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    load(true);
  }
  async function addWatch(sym?: string, market?: string) {
    const s = (sym ?? newSym).trim().toUpperCase();
    if (!s) return;
    if (!sym) setNewSym("");
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: s, market: market ?? "US" }) });
    load(true);
  }
  async function removeWatch(id: string) {
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    load(true);
  }
  async function saveTarget(symbol: string, price: number) {
    const pct = Number(targetPct[symbol]);
    if (!Number.isFinite(pct)) return;
    const targetPrice = Math.round(price * (1 + pct / 100) * 100) / 100;
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, targetPrice }) });
    load(true);
  }
  async function genBrief() {
    setBusy("brief");
    await fetch("/api/news/today", { method: "POST" });
    await load(true);
    setBusy("");
  }
  async function runCheck() {
    setBusy("check");
    const r = await fetch("/api/signals/check", { method: "POST" }).then((x) => x.json());
    setBusy("");
    alert(`신호 점검 완료 — 알림 ${r.notifiedCount ?? 0}건 발송`);
  }
  async function toggleChannel(key: keyof Settings) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: next[key] }) });
  }
  async function testNotify() {
    setBusy("test");
    const r = await fetch("/api/notify/test", { method: "POST" }).then((x) => x.json());
    setBusy("");
    const lines = (r.results ?? []).map((x: { channel: string; ok: boolean; detail: string }) => `${x.ok ? "✅" : "❌"} ${x.channel}: ${x.detail}`).join("\n");
    alert(`테스트 알림 결과\n\n${lines}`);
  }
  const loadRecs = useCallback(async (market: string) => {
    setRecBusy(true);
    try {
      const r = await fetch(`/api/recommend?market=${market}&risk=${encodeURIComponent(riskRef.current)}`).then((x) => x.json());
      if (r.ok) setRecs(r.data);
    } finally { setRecBusy(false); }
  }, []);
  useEffect(() => { loadRecs(recMarket); }, [recMarket, loadRecs]);

  function toggle(sym: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });
  }

  const pnlUp = (pf?.totalPnl ?? 0) >= 0;
  const newsItems: NewsItem[] = brief?.itemsJson ? JSON.parse(brief.itemsJson) : [];

  const groups = Object.entries(
    signals.reduce<Record<string, SignalRow[]>>((acc, s) => { (acc[s.market] ??= []).push(s); return acc; }, {})
  ).sort((a, b) => (MARKET_META[a[0]]?.order ?? 9) - (MARKET_META[b[0]]?.order ?? 9));

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>GlobalTrade Advisor</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>세계 증시 모니터링 · 매매 신호 알림 (토스증권 알림 전용 모드)</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn" onClick={() => setLive((v) => !v)} style={live ? { borderColor: "var(--up)", color: "var(--up)" } : {}}>
            <span className={live ? "pulse" : ""} style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: live ? "var(--up)" : "var(--text-faint)", marginRight: 6, verticalAlign: "middle" }} />
            {live ? "실시간 ON" : "실시간 OFF"}
          </button>
          <button className="btn" onClick={() => load()} disabled={busy === "load"}>{busy === "load" ? "갱신 중…" : "↻"}</button>
        </div>
      </div>

      {/* 포트폴리오 요약 — 시드머니 편집 가능 */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 14 }}>
        <div className="card" style={{ padding: "12px 14px" }}>
          <div className="muted" style={{ fontSize: 12 }}>시드머니 (편집)</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input value={seedEdit} onChange={(e) => setSeedEdit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveSeed()} inputMode="numeric"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "6px 8px", fontSize: 14, width: "100%" }} />
            <button className="btn" onClick={saveSeed} style={{ padding: "6px 10px" }}>저장</button>
          </div>
        </div>
        <div className="card" style={{ padding: "12px 14px" }}><div className="muted" style={{ fontSize: 12 }}>총 평가금액</div><div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{pf ? won(pf.totalValue) : "—"}</div></div>
        <div className="card" style={{ padding: "12px 14px" }}><div className="muted" style={{ fontSize: 12 }}>평가손익</div><div className={pnlUp ? "up" : "down"} style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{pf ? (pnlUp ? "+" : "") + won(pf.totalPnl) : "—"}</div></div>
        <div className="card" style={{ padding: "12px 14px" }}><div className="muted" style={{ fontSize: 12 }}>수익률</div><div className={pnlUp ? "up" : "down"} style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{pf ? `${pnlUp ? "+" : ""}${pf.totalPnlPercent.toFixed(1)}%` : "—"}</div></div>
      </div>

      {/* 보유종목 CRUD */}
      <div className="card" style={{ padding: 14, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>💼 보유종목</h2>
          <span className="spin">{pf?.holdings.length ?? 0}개 · 현금 {pf ? won(pf.cashBalance) : "—"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 80px 90px 110px auto", gap: 8, marginBottom: 12 }}>
          <input value={holdingForm.symbol} onChange={(e) => setHoldingForm((p) => ({ ...p, symbol: e.target.value }))} placeholder="심볼" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
          <input value={holdingForm.market} onChange={(e) => setHoldingForm((p) => ({ ...p, market: e.target.value.toUpperCase() }))} placeholder="시장" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
          <input value={holdingForm.qty} onChange={(e) => setHoldingForm((p) => ({ ...p, qty: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addHolding()} placeholder="수량" inputMode="decimal" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
          <input value={holdingForm.avgBuyPrice} onChange={(e) => setHoldingForm((p) => ({ ...p, avgBuyPrice: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addHolding()} placeholder="평단가" inputMode="decimal" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
          <button className="btn" onClick={addHolding}>추가</button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {pf?.holdings.map((h) => {
            const edit = holdingEdits[h.id] ?? { qty: String(h.qty), avgBuyPrice: String(h.avgBuyPrice) };
            const up = h.pnl >= 0;
            return (
              <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 90px 110px 110px 120px auto", gap: 8, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{h.symbol}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{h.market} · 현재 {h.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} {h.currency}</div>
                </div>
                <input value={edit.qty} onChange={(e) => setHoldingEdits((p) => ({ ...p, [h.id]: { ...edit, qty: e.target.value } }))} inputMode="decimal" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
                <input value={edit.avgBuyPrice} onChange={(e) => setHoldingEdits((p) => ({ ...p, [h.id]: { ...edit, avgBuyPrice: e.target.value } }))} inputMode="decimal" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
                <div className="muted" style={{ fontSize: 12 }}>{won(h.marketValue)}</div>
                <div className={up ? "up" : "down"} style={{ fontSize: 12 }}>{up ? "+" : ""}{won(h.pnl)} · {up ? "+" : ""}{h.pnlPercent.toFixed(1)}%</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => saveHolding(h)} style={{ padding: "5px 9px", fontSize: 12 }}>저장</button>
                  <button className="btn" onClick={() => removeHolding(h.id)} style={{ padding: "5px 9px", fontSize: 12 }}>삭제</button>
                </div>
              </div>
            );
          })}
          {pf && !pf.holdings.length && <span className="spin">아직 보유종목이 없습니다.</span>}
        </div>
      </div>

      {/* 리스크 + 알림 설정 */}
      <div className="card" style={{ padding: 14, marginBottom: 24, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12 }}>리스크</span>
        {RISKS.map((r) => (<button key={r} className="btn" onClick={() => changeRisk(r)} style={{ ...(risk === r ? { borderColor: "var(--accent)", color: "#fff" } : {}) }}>{r}형</button>))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span className="spin">{updated && `갱신 ${updated}`}{live && ` · ${countdown}s 후 자동`}</span>
          <button className="btn" onClick={runCheck} disabled={busy === "check"}>{busy === "check" ? "점검 중…" : "🔔 신호 점검·알림"}</button>
        </div>
        <div style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>알림 채널</span>
          {([["notifyEmail", "📧 이메일"], ["notifyKakao", "💬 카카오"], ["notifyPush", "📱 푸시"]] as const).map(([k, label]) => (
            <button key={k} className="btn" onClick={() => toggleChannel(k)} style={settings[k] ? { borderColor: "var(--up)", color: "var(--up)" } : { opacity: 0.6 }}>{settings[k] ? "● " : "○ "}{label}</button>
          ))}
          <button className="btn" onClick={testNotify} disabled={busy === "test"} style={{ marginLeft: "auto" }}>{busy === "test" ? "보내는 중…" : "테스트 알림 보내기"}</button>
        </div>
      </div>

      {/* 세계 증시 */}
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>🌍 세계 증시</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", marginBottom: 24 }}>
        {indices.map((i) => { const up = i.changePercent >= 0; return (
          <div key={i.symbol} className="card" style={{ padding: "12px 14px" }}>
            <div className="muted" style={{ fontSize: 12 }}>{i.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{i.price.toLocaleString("ko-KR", { maximumFractionDigits: i.currency === "KRW" ? 0 : 2 })}</div>
            <div className={up ? "up" : "down"} style={{ fontSize: 13, marginTop: 2 }}>{up ? "▲" : "▼"} {Math.abs(i.changePercent).toFixed(2)}%</div>
          </div>); })}
      </div>

      {/* 국가별 종목 추천 */}
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>📈 국가별 종목 추천</h2>
      <div className="card" style={{ padding: 14, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {REC_MARKETS.map((m) => { const meta = MARKET_META[m]; return (
            <button key={m} className="btn" onClick={() => setRecMarket(m)} style={recMarket === m ? { borderColor: "var(--accent)", color: "#fff" } : {}}>{meta.flag} {meta.label}</button>); })}
          <span className="spin" style={{ marginLeft: "auto", alignSelf: "center" }}>{recBusy ? "스캔 중…" : `${MARKET_META[recMarket].label} 점수 높은 순`}</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {recs.slice(0, 6).map((r) => {
            const inWatch = watch.some((w) => w.symbol === r.symbol);
            return (
              <div key={r.symbol} className="card" style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div><div className="muted" style={{ fontSize: 11 }}>{r.symbol} · score {r.score}</div></div>
                  <span className={`badge ${r.tone}`}>{r.label}</span>
                </div>
                <div className="muted" style={{ fontSize: 11.5, margin: "8px 0", lineHeight: 1.5, minHeight: 32 }}>{r.reasons[0] ?? "—"}</div>
                <button className="btn" onClick={() => addWatch(r.symbol, recMarket)} disabled={inWatch} style={{ width: "100%", fontSize: 12, ...(inWatch ? { opacity: 0.5 } : {}) }}>{inWatch ? "이미 추가됨" : "+ 워치리스트 담기"}</button>
              </div>
            );
          })}
          {!recs.length && !recBusy && <span className="spin">추천 결과가 없습니다.</span>}
        </div>
      </div>

      {/* 관심종목 — 국가별 카드 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>🚦 관심종목 · 매매 신호</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <input value={newSym} onChange={(e) => setNewSym(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addWatch()} placeholder="심볼 추가 (예: GOOGL, 7203.T)" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontSize: 13, width: 200 }} />
          <button className="btn" onClick={() => addWatch()}>+ 추가</button>
        </div>
      </div>

      {groups.map(([market, rows]) => { const meta = MARKET_META[market] ?? MARKET_META.ETC; return (
        <div key={market} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)", margin: "0 0 8px" }}>{meta.flag} {meta.label} <span style={{ color: "var(--text-faint)" }}>· {rows.length}</span></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {rows.map((s) => {
              const open = expanded.has(s.symbol);
              const w = watch.find((x) => x.symbol === s.symbol);
              const links = externalLinks(s.symbol);
              return (
                <div key={s.symbol} className="card" style={{ padding: 0, cursor: "pointer", borderColor: open ? "var(--accent)" : undefined }} onClick={() => toggle(s.symbol)}>
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.symbol}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} · score {s.score}{s.rsi != null ? ` · RSI ${s.rsi.toFixed(0)}` : ""}{w?.targetPrice ? ` · 🎯${w.targetPrice.toLocaleString("ko-KR")}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className={`badge ${s.tone}`}>{s.label}</span><span className="muted" style={{ fontSize: 11 }}>{open ? "▲" : "▼"}</span></div>
                  </div>
                  {open && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-dim)" }}>📌 추천 이유</div>
                      <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>{s.reasons.length ? s.reasons.map((r, idx) => <li key={idx}>{r}</li>) : <li className="muted">뚜렷한 신호 없음 (관망)</li>}</ul>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {s.indicators.maTrend && <span className="chip">MA {s.indicators.maTrend}추세</span>}
                        {s.indicators.goldenCross && <span className="chip up">골든크로스</span>}
                        {s.indicators.deadCross && <span className="chip down">데드크로스</span>}
                        {s.indicators.macdState && <span className="chip">MACD {s.indicators.macdState}</span>}
                        {s.indicators.touchedLower && <span className="chip up">볼린저 하단</span>}
                        {s.indicators.touchedUpper && <span className="chip down">볼린저 상단</span>}
                        {s.rsi != null && <span className="chip">RSI {s.rsi.toFixed(0)}</span>}
                      </div>
                      {/* 목표 % 설정 */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
                        <span className="muted" style={{ fontSize: 12 }}>목표 수익</span>
                        <input value={targetPct[s.symbol] ?? ""} onChange={(e) => setTargetPct((p) => ({ ...p, [s.symbol]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && saveTarget(s.symbol, s.price)} placeholder="%" inputMode="numeric"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 8px", fontSize: 12, width: 70 }} />
                        <button className="btn" onClick={() => saveTarget(s.symbol, s.price)} style={{ padding: "5px 10px", fontSize: 12 }}>목표가 설정</button>
                        {w?.targetPrice && <span className="spin">현재 목표가 {w.targetPrice.toLocaleString("ko-KR")} (도달 시 알림)</span>}
                      </div>
                      <div style={{ margin: "0 0 12px" }}><StockChart symbol={s.symbol} /></div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <a className="btn" href={links.investing} target="_blank" rel="noreferrer">Investing ↗</a>
                        <a className="btn" href={links.google} target="_blank" rel="noreferrer">구글 파이낸스 ↗</a>
                        <a className="btn" href={links.yahoo} target="_blank" rel="noreferrer">Yahoo ↗</a>
                        {w && <button className="btn" onClick={() => removeWatch(w.id)} style={{ marginLeft: "auto" }}>✕ 제거</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>); })}
      {!signals.length && <div className="card" style={{ padding: 14 }}><span className="spin">{busy === "load" ? "신호 계산 중…" : "워치리스트가 비어 있습니다."}</span></div>}

      {/* 뉴스 브리핑 — 일반/초딩 토글 + 기사 이미지·링크 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 10px", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>📰 일일 뉴스 브리핑</h2>
        <button className="btn" onClick={() => setKidMode((v) => !v)} style={kidMode ? { borderColor: "var(--warn)", color: "var(--warn)" } : {}}>{kidMode ? "🧒 초딩버전" : "🧑 일반버전"}</button>
        <button className="btn" onClick={genBrief} disabled={busy === "brief"} style={{ marginLeft: "auto" }}>{busy === "brief" ? "생성 중…" : "오늘자 생성"}</button>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {brief ? (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.7 }}>{kidMode ? (brief.kidMd ?? "초딩 버전이 없습니다. ‘오늘자 생성’을 눌러주세요.") : brief.contentMd}</pre>
        ) : <span className="spin">아직 브리핑이 없습니다. ‘오늘자 생성’을 눌러보세요. (매일 07:00 자동 생성은 cron으로 연결)</span>}
      </div>
      {newsItems.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 24 }}>
          {newsItems.map((n, idx) => (
            <a key={idx} className="card newsitem" href={n.link} target="_blank" rel="noreferrer" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start", textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.favicon || "https://www.google.com/s2/favicons?domain=news.google.com&sz=64"} alt="" width={20} height={20} style={{ borderRadius: 4, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{n.title}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{n.source} ↗</div>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="spin" style={{ lineHeight: 1.6 }}>※ 모든 신호·뉴스는 투자 참고용이며 최종 책임은 본인에게 있습니다. 매매는 토스증권 등 본인 계좌에서 직접 진행하세요. 데이터: Yahoo Finance · Google News(무료).</p>
    </div>
  );
}
