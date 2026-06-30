"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MARKET_META, externalLinks } from "@/lib/markets";
import StockChart from "./StockChart";
import BacktestPanel from "./BacktestPanel";

type IndexRow = { symbol: string; label: string; price: number; changePercent: number; currency: string };
type Indic = {
  rsi: number | null; maTrend: string | null; goldenCross: boolean; deadCross: boolean;
  macdState: string | null; macdCrossUp: boolean; macdCrossDown: boolean; touchedLower: boolean; touchedUpper: boolean;
};
type NewsHeadline = { title: string; link: string; source: string; favicon: string; label?: string; impact?: number; reason?: string };
type Kid = { headline: string; points: string[]; caveat: string };
type Levels = { target: number; targetPct: number; stop: number; stopPct: number };
type SignalRow = { symbol: string; name: string; market: string; label: string; tone: string; type: string; score: number; techScore: number; newsScore: number; newsLabel: string; price: number; rsi: number | null; reasons: string[]; kid: Kid; levels: Levels; news: NewsHeadline[]; indicators: Indic };
type WatchRow = { id: string; symbol: string; market: string; targetPrice: number | null; stopLoss: number | null };
type Holding = { id: string; symbol: string; market: string; qty: number; avgBuyPrice: number; price: number; currency: string; marketValue: number; pnl: number; pnlPercent: number };
type Portfolio = { seedAmount: number; cashBalance: number; totalValue: number; totalPnl: number; totalPnlPercent: number; holdings: Holding[] };
type NewsItem = { title: string; link: string; source: string; favicon: string };
type Brief = { date: string; contentMd: string; kidMd: string | null; itemsJson: string | null; summary: string } | null;
type Settings = { notifyEmail: boolean; notifyKakao: boolean; notifyPush: boolean };
type Rec = {
  symbol: string;
  name: string;
  type: string;
  label: string;
  tone: string;
  score: number;
  techScore: number;
  newsScore: number;
  newsLabel: string;
  price: number;
  rsi: number | null;
  reasons: string[];
  levels: Levels;
  confidence: string;
  allocationHint: string;
  summary: string;
  strengths: string[];
  risks: string[];
  actionPlan: string[];
  checklist: string[];
  news: NewsHeadline[];
};
type CompareRow = {
  symbol: string; name: string; label: string; score: number; techScore: number; newsScore: number; newsLabel: string;
  market: string; sector: string; price: number; rsi: number | null; trend: string; volatility: number; volumeRatio: number; levels: Levels;
  reasons: string[];
  news: NewsHeadline[]; backtest: { strategyReturnPct: number; buyHoldReturnPct: number; winRate: number; maxDrawdownPct: number; trades: number } | null;
};
type InsightData = {
  briefing: {
    title: string; mood: string; indexAvg: number; generatedAt: string;
    focus: CompareRow[]; riskNews: { symbol: string; title: string; source: string; impact: number }[]; actions: string[];
  };
  riskAlerts: { symbol: string; severity: "HIGH" | "MED" | "LOW"; title: string; detail: string }[];
  rebalance: { summary: string; suggestions: string[] };
  radar: {
    movers: { symbol: string; name: string; price: number; changePercent: number; volumeRatio: number; divergence: string }[];
    volumeSpikes: { symbol: string; name: string; price: number; changePercent: number; volumeRatio: number; divergence: string }[];
    divergences: { symbol: string; name: string; price: number; changePercent: number; volumeRatio: number; divergence: string }[];
  };
} | null;
type JournalEntry = { id: string; date: string; symbol: string; action: string; reason: string; result: string };
type TabKey = "overview" | "pro" | "portfolio" | "recommend" | "signals" | "news";
type ImportHolding = { symbol: string; market: string; qty: string; avgBuyPrice: string; raw: string };
type Scenario = { symbol: string; entry: string; budget: string; stopPct: string; targetPct: string };

const RISKS = ["안정", "중립", "공격"] as const;
const REC_MARKETS = ["US", "KR", "JP", "HK"] as const;
const TABS: { id: TabKey; label: string; hint: string }[] = [
  { id: "overview", label: "마켓 홈", hint: "방송 화면" },
  { id: "pro", label: "프로 분석", hint: "브리핑·비교" },
  { id: "portfolio", label: "포트폴리오", hint: "보유·OCR" },
  { id: "recommend", label: "추천 종목", hint: "국가별" },
  { id: "signals", label: "관심 신호", hint: "알림" },
  { id: "news", label: "뉴스", hint: "일일 브리핑" },
];
const POLL_SEC = 10;
const GRADE_CLASS: Record<string, string> = { STRONG_BUY: "g-sbuy", BUY: "g-buy", HOLD: "g-hold", SELL: "g-sell", STRONG_SELL: "g-ssell" };
const GRADE_COLOR: Record<string, string> = { STRONG_BUY: "#11d488", BUY: "#4fd6a0", HOLD: "#c2cad6", SELL: "#ff7a8c", STRONG_SELL: "#f6465d" };
const TOSS_NAME_SYMBOLS: Record<string, { symbol: string; market: string }> = {
  삼성전자: { symbol: "005930.KS", market: "KR" },
  "SK하이닉스": { symbol: "000660.KS", market: "KR" },
  네이버: { symbol: "035420.KS", market: "KR" },
  NAVER: { symbol: "035420.KS", market: "KR" },
  카카오: { symbol: "035720.KS", market: "KR" },
  현대차: { symbol: "005380.KS", market: "KR" },
  기아: { symbol: "000270.KS", market: "KR" },
  셀트리온: { symbol: "068270.KS", market: "KR" },
  "LG화학": { symbol: "051910.KS", market: "KR" },
  "LG에너지솔루션": { symbol: "373220.KS", market: "KR" },
  삼성바이오로직스: { symbol: "207940.KS", market: "KR" },
  삼성SDI: { symbol: "006400.KS", market: "KR" },
  포스코홀딩스: { symbol: "005490.KS", market: "KR" },
  POSCO홀딩스: { symbol: "005490.KS", market: "KR" },
  KB금융: { symbol: "105560.KS", market: "KR" },
  신한지주: { symbol: "055550.KS", market: "KR" },
  엔비디아: { symbol: "NVDA", market: "US" },
  애플: { symbol: "AAPL", market: "US" },
  테슬라: { symbol: "TSLA", market: "US" },
  마이크로소프트: { symbol: "MSFT", market: "US" },
  알파벳: { symbol: "GOOGL", market: "US" },
  아마존: { symbol: "AMZN", market: "US" },
  브로드컴: { symbol: "AVGO", market: "US" },
  AMD: { symbol: "AMD", market: "US" },
  TSMC: { symbol: "TSM", market: "US" },
};
function won(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }
function scorePct(s: number) { return Math.max(0, Math.min(100, (s + 100) / 2)); }
function signed(n: number) { return `${n >= 0 ? "+" : ""}${n}`; }
function priceText(n: number) { return n.toLocaleString("ko-KR", { maximumFractionDigits: n >= 1000 ? 0 : 2 }); }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function percent(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }
function cleanNumeric(value: string) { return value.replace(/[^\d.]/g, ""); }
function findHoldingNumbers(chunk: string) {
  const qty = chunk.match(/([\d,.]+)\s*주/);
  const avg = chunk.match(/(?:평균단가|평단|매입가|매수평균가|매수단가)[^\d]{0,16}([\d,.]+)/);
  const fallbackMoney = [...chunk.matchAll(/([\d,]+(?:\.\d+)?)\s*(?:원|USD|\$)/g)].map((m) => cleanNumeric(m[1])).filter(Boolean);
  return {
    qty: qty ? cleanNumeric(qty[1]) : "",
    avgBuyPrice: avg ? cleanNumeric(avg[1]) : (fallbackMoney.length >= 2 ? fallbackMoney[1] : fallbackMoney[0] ?? ""),
  };
}
function parseTossHoldings(text: string): ImportHolding[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const compactLines = lines.map((line) => line.replace(/\s/g, ""));
  const rows: ImportHolding[] = [];
  const seen = new Set<string>();

  function push(symbol: string, market: string, chunk: string) {
    if (seen.has(symbol)) return;
    const nums = findHoldingNumbers(chunk);
    rows.push({ symbol, market, qty: nums.qty, avgBuyPrice: nums.avgBuyPrice, raw: chunk.slice(0, 180) });
    seen.add(symbol);
  }

  Object.entries(TOSS_NAME_SYMBOLS).forEach(([name, info]) => {
    const needle = name.replace(/\s/g, "");
    const idx = compactLines.findIndex((line) => line.includes(needle));
    if (idx >= 0) push(info.symbol, info.market, lines.slice(idx, idx + 7).join(" "));
  });

  lines.forEach((line, idx) => {
    const symbol = line.match(/\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/)?.[0];
    if (!symbol || ["USD", "KRW", "ETF"].includes(symbol)) return;
    const market = symbol.endsWith(".KS") || symbol.endsWith(".KQ") ? "KR" : symbol.endsWith(".T") ? "JP" : symbol.endsWith(".HK") ? "HK" : "US";
    push(symbol, market, lines.slice(idx, idx + 6).join(" "));
  });

  return rows;
}
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) return { ok: false, error: `empty response ${res.status}` };
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `invalid json ${res.status}` };
  }
}
function MiniSpark({ seed, up }: { seed: number; up: boolean }) {
  const pts = Array.from({ length: 18 }, (_, i) => {
    const wave = Math.sin((i + seed) * 0.8) * 10 + Math.cos((i + seed) * 0.35) * 7;
    const drift = up ? 42 - i * 1.35 : 20 + i * 1.25;
    return `${(i / 17) * 100},${Math.max(5, Math.min(55, drift + wave))}`;
  }).join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 60" aria-hidden="true">
      <polyline points={pts} />
    </svg>
  );
}
function labelClass(label: string) {
  if (label.includes("강한 매수")) return "g-sbuy";
  if (label.includes("강한 매도")) return "g-ssell";
  if (label.includes("매수")) return "g-buy";
  if (label.includes("매도")) return "g-sell";
  return "g-hold";
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
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
  const [importBusy, setImportBusy] = useState(false);
  const [importText, setImportText] = useState("");
  const [importRows, setImportRows] = useState<ImportHolding[]>([]);
  const [kidMode, setKidMode] = useState(false);
  const [recMarket, setRecMarket] = useState<(typeof REC_MARKETS)[number]>("US");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [recBusy, setRecBusy] = useState(false);
  const [openRecs, setOpenRecs] = useState<Set<string>>(new Set());
  const [insights, setInsights] = useState<InsightData>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [compareInput, setCompareInput] = useState("NVDA, AMD, AVGO");
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [compareBusy, setCompareBusy] = useState(false);
  const [scenario, setScenario] = useState<Scenario>({ symbol: "NVDA", entry: "", budget: "1000000", stopPct: "5", targetPct: "12" });
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalForm, setJournalForm] = useState({ symbol: "", action: "매수", reason: "", result: "" });
  const [symbolSearch, setSymbolSearch] = useState("");
  const [symbolAnalysis, setSymbolAnalysis] = useState<CompareRow | null>(null);
  const [symbolBusy, setSymbolBusy] = useState(false);
  const [symbolError, setSymbolError] = useState("");
  const [targetPct, setTargetPct] = useState<Record<string, string>>({});
  const [stopPct, setStopPct] = useState<Record<string, string>>({});
  const [uid, setUid] = useState<string | null>(null);
  const [idInput, setIdInput] = useState("");
  const riskRef = useRef(risk);
  riskRef.current = risk;

  const load = useCallback(async (silent = false) => {
    if (!silent) setBusy("load");
    try {
      const [i, s, w, p, b, st] = await Promise.all([
        fetch("/api/market/indices").then(safeJson),
        fetch(`/api/signals?risk=${encodeURIComponent(riskRef.current)}`).then(safeJson),
        fetch("/api/watchlist").then(safeJson),
        fetch("/api/portfolio").then(safeJson),
        fetch("/api/news/today").then(safeJson),
        fetch("/api/settings").then(safeJson),
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

  useEffect(() => { load(); fetch("/api/user").then(safeJson).then((d) => { if (d.ok) setUid(d.uid); }); }, [load]);

  async function login() {
    const id = idInput.trim().toLowerCase();
    if (!id) return;
    const r = await fetch("/api/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(safeJson);
    if (!r.ok) { alert(r.error ?? "로그인 실패"); return; }
    setUid(r.uid); setIdInput("");
    load();
  }
  async function logout() {
    await fetch("/api/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "" }) });
    setUid(null);
    load();
  }
  async function saveStop(symbol: string, price: number) {
    const pct = Number(stopPct[symbol]);
    if (!Number.isFinite(pct)) return;
    const stopLoss = Math.round(price * (1 - Math.abs(pct) / 100) * 100) / 100;
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, stopLoss }) });
    load(true);
  }

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
    await fetch("/api/holdings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...holdingForm, symbol, qty, avgBuyPrice }) });
    setHoldingForm({ symbol: "", market: "US", qty: "", avgBuyPrice: "" });
    load(true);
  }
  async function importTossImage(file?: File) {
    if (!file) return;
    setImportBusy(true);
    try {
      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(file, "kor+eng");
      const text = result.data.text;
      setImportText(text);
      setImportRows(parseTossHoldings(text));
    } catch (e) {
      alert(`사진 인식 실패: ${(e as Error).message}\n텍스트 붙여넣기 방식으로 다시 시도해 주세요.`);
    } finally {
      setImportBusy(false);
    }
  }
  function updateImportRow(idx: number, patch: Partial<ImportHolding>) {
    setImportRows((rows) => rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function removeImportRow(idx: number) {
    setImportRows((rows) => rows.filter((_, i) => i !== idx));
  }
  function addImportRow() {
    setImportRows((rows) => [{ symbol: "", market: "US", qty: "", avgBuyPrice: "", raw: "직접 입력" }, ...rows]);
  }
  async function addImportedHoldings() {
    const candidates = importRows
      .map((row) => ({
        ...row,
        symbol: row.symbol.trim().toUpperCase(),
        market: row.market.trim().toUpperCase() || "US",
        qtyNum: Number(row.qty),
        avgNum: Number(row.avgBuyPrice),
      }))
      .filter((row) => row.symbol && Number.isFinite(row.qtyNum) && Number.isFinite(row.avgNum) && row.qtyNum > 0 && row.avgNum >= 0);
    if (!candidates.length) return;
    setImportBusy(true);
    try {
      await Promise.all(candidates.map((row) => fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: row.symbol, market: row.market, qty: row.qtyNum, avgBuyPrice: row.avgNum }),
      })));
      setImportRows([]);
      await load(true);
    } finally {
      setImportBusy(false);
    }
  }
  async function saveHolding(h: Holding) {
    const edit = holdingEdits[h.id];
    if (!edit) return;
    const qty = Number(edit.qty);
    const avgBuyPrice = Number(edit.avgBuyPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(avgBuyPrice) || qty <= 0 || avgBuyPrice < 0) return;
    await fetch(`/api/holdings/${h.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qty, avgBuyPrice }) });
    load(true);
  }
  async function removeHolding(id: string) { await fetch(`/api/holdings/${id}`, { method: "DELETE" }); load(true); }
  async function addWatch(sym?: string, market?: string) {
    const s = (sym ?? newSym).trim().toUpperCase();
    if (!s) return;
    if (!sym) setNewSym("");
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: s, market: market ?? "US" }) });
    load(true);
  }
  async function removeWatch(id: string) { await fetch(`/api/watchlist/${id}`, { method: "DELETE" }); load(true); }
  async function saveTarget(symbol: string, price: number) {
    const pct = Number(targetPct[symbol]);
    if (!Number.isFinite(pct)) return;
    const targetPrice = Math.round(price * (1 + pct / 100) * 100) / 100;
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, targetPrice }) });
    load(true);
  }
  async function genBrief() { setBusy("brief"); await fetch("/api/news/today", { method: "POST" }); await load(true); setBusy(""); }
  async function runCheck() {
    setBusy("check");
    const r = await fetch("/api/signals/check", { method: "POST" }).then(safeJson);
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
    const r = await fetch("/api/notify/test", { method: "POST" }).then(safeJson);
    setBusy("");
    const lines = (r.results ?? []).map((x: { channel: string; ok: boolean; detail: string }) => `${x.ok ? "✅" : "❌"} ${x.channel}: ${x.detail}`).join("\n");
    alert(`테스트 알림 결과\n\n${lines}`);
  }
  const loadRecs = useCallback(async (market: string) => {
    setRecBusy(true);
    try {
      const r = await fetch(`/api/recommend?market=${market}&risk=${encodeURIComponent(riskRef.current)}`).then(safeJson);
      if (r.ok) setRecs(r.data);
    } finally { setRecBusy(false); }
  }, []);
  useEffect(() => { loadRecs(recMarket); }, [recMarket, loadRecs]);

  const loadInsights = useCallback(async () => {
    setInsightsBusy(true);
    try {
      const r = await fetch(`/api/insights?market=${recMarket}&risk=${encodeURIComponent(riskRef.current)}`).then(safeJson);
      if (r.ok) setInsights(r);
    } finally { setInsightsBusy(false); }
  }, [recMarket]);
  useEffect(() => { loadInsights(); }, [loadInsights]);

  async function runCompare() {
    const symbols = compareInput.split(",").map((s) => s.trim()).filter(Boolean).join(",");
    if (!symbols) return;
    setCompareBusy(true);
    try {
      const r = await fetch(`/api/compare?symbols=${encodeURIComponent(symbols)}&risk=${encodeURIComponent(riskRef.current)}`).then(safeJson);
      if (r.ok) setCompareRows(r.data);
    } finally { setCompareBusy(false); }
  }
  async function analyzeAnySymbol(sym?: string) {
    const symbol = (sym ?? symbolSearch).trim().toUpperCase();
    if (!symbol) return;
    setSymbolBusy(true);
    setSymbolError("");
    try {
      const r = await fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}&risk=${encodeURIComponent(riskRef.current)}`).then(safeJson);
      if (r.ok) {
        setSymbolAnalysis(r.data);
        setSymbolSearch(symbol);
      } else {
        setSymbolError(r.error ?? "분석 실패");
      }
    } catch (e) {
      setSymbolError((e as Error).message);
    } finally {
      setSymbolBusy(false);
    }
  }
  useEffect(() => { runCompare(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("stock-master-journal");
      if (raw) setJournal(JSON.parse(raw));
    } catch {}
  }, []);
  function saveJournal(next: JournalEntry[]) {
    setJournal(next);
    localStorage.setItem("stock-master-journal", JSON.stringify(next));
  }
  function addJournal() {
    const symbol = journalForm.symbol.trim().toUpperCase();
    if (!symbol || !journalForm.reason.trim()) return;
    saveJournal([{ id: crypto.randomUUID(), date: new Date().toISOString(), ...journalForm, symbol }, ...journal].slice(0, 50));
    setJournalForm({ symbol: "", action: "매수", reason: "", result: "" });
  }
  function deleteJournal(id: string) {
    saveJournal(journal.filter((j) => j.id !== id));
  }

  function toggle(sym: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });
  }
  function toggleRec(sym: string) {
    setOpenRecs((prev) => { const n = new Set(prev); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });
  }
  function downloadRecommendationReport() {
    if (!recs.length) return;
    const meta = MARKET_META[recMarket];
    const lines = [
      `# ${meta.flag} ${meta.label} 종목 추천 리포트`,
      ``,
      `- 생성: ${new Date().toLocaleString("ko-KR")}`,
      `- 시장: ${meta.label}`,
      `- 리스크 성향: ${risk}`,
      `- 분석 방식: 기술지표(이동평균, RSI, MACD, 볼린저밴드) + 최신 뉴스 감성 + 변동성 기반 목표/손절가`,
      ``,
      `> 본 리포트는 투자 참고용이며 매수/매도 보장이 아닙니다.`,
      ``,
      ...recs.slice(0, 8).flatMap((r, idx) => [
        `## ${idx + 1}. ${r.name} (${r.symbol}) — ${r.label} / ${r.score}점`,
        ``,
        `- 현재가: ${priceText(r.price)}`,
        `- 신뢰도: ${r.confidence}`,
        `- 점수: 기술 ${r.techScore}점, 뉴스 ${signed(r.newsScore)}점(${r.newsLabel})`,
        `- 투자 비중 힌트: ${r.allocationHint}`,
        `- 목표가: ${priceText(r.levels.target)} (+${r.levels.targetPct.toFixed(1)}%)`,
        `- 손절가: ${priceText(r.levels.stop)} (${r.levels.stopPct.toFixed(1)}%)`,
        ``,
        `### 추천 이유`,
        ...r.strengths.map((x) => `- ${x}`),
        ``,
        `### 주의할 점`,
        ...r.risks.map((x) => `- ${x}`),
        ``,
        `### 매매 체크리스트`,
        ...r.checklist.map((x) => `- ${x}`),
        ``,
      ]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-recommend-report-${recMarket}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function openHtmlReport() {
    window.open(`/api/report/html?market=${recMarket}&risk=${encodeURIComponent(risk)}`, "_blank", "noreferrer");
  }
  function openSymbolReport(symbol: string) {
    window.open(`/api/analyze/report?symbol=${encodeURIComponent(symbol)}&risk=${encodeURIComponent(risk)}`, "_blank", "noreferrer");
  }

  const journalStats = {
    total: journal.length,
    loss: journal.filter((j) => /손실|실패|손절|후회|늦/.test(j.result + j.reason)).length,
    noPlan: journal.filter((j) => !/손절|목표|분할|근거|리스크/.test(j.reason)).length,
  };

  const pnlUp = (pf?.totalPnl ?? 0) >= 0;
  const newsItems: NewsItem[] = brief?.itemsJson ? JSON.parse(brief.itemsJson) : [];
  const groups = Object.entries(
    signals.reduce<Record<string, SignalRow[]>>((acc, s) => { (acc[s.market] ??= []).push(s); return acc; }, {})
  ).sort((a, b) => (MARKET_META[a[0]]?.order ?? 9) - (MARKET_META[b[0]]?.order ?? 9));
  const holdingValue = pf?.holdings.reduce((sum, h) => sum + h.marketValue, 0) ?? 0;
  const cashRatio = pf?.totalValue ? (pf.cashBalance / pf.totalValue) * 100 : 0;
  const allocations = (pf?.holdings ?? [])
    .map((h) => ({ ...h, weight: pf?.totalValue ? (h.marketValue / pf.totalValue) * 100 : 0 }))
    .sort((a, b) => b.weight - a.weight);
  const topWeight = allocations[0]?.weight ?? 0;
  const lossCount = pf?.holdings.filter((h) => h.pnl < 0).length ?? 0;
  const portfolioHealth = clamp(
    Math.round(82 + (pf?.totalPnlPercent ?? 0) * 1.4 + Math.min(cashRatio, 30) * 0.35 - Math.max(0, topWeight - 35) * 0.9 - lossCount * 5),
    0,
    100
  );
  const portfolioVerdict = portfolioHealth >= 78 ? "균형 양호" : portfolioHealth >= 55 ? "점검 필요" : "방어 우선";
  const portfolioChecklist = [
    cashRatio < 8 ? "현금 비중이 낮습니다. 신규 진입보다 손절/익절 기준을 먼저 정리하세요." : "현금 완충 구간이 확보되어 있습니다.",
    topWeight > 45 ? `${allocations[0]?.symbol} 비중이 ${topWeight.toFixed(1)}%로 높습니다. 분할 익절/헤지 기준을 세우세요.` : "단일 종목 쏠림은 과도하지 않습니다.",
    lossCount >= 3 ? "손실 종목이 여러 개입니다. 반등 기대보다 종목별 무효화 조건을 우선하세요." : "손실 종목 수는 관리 가능한 범위입니다.",
  ];
  const actionableSignals = signals
    .map((s) => {
      const distanceToTarget = watch.find((w) => w.symbol === s.symbol)?.targetPrice
        ? ((watch.find((w) => w.symbol === s.symbol)!.targetPrice! - s.price) / s.price) * 100
        : null;
      const distanceToStop = watch.find((w) => w.symbol === s.symbol)?.stopLoss
        ? ((s.price - watch.find((w) => w.symbol === s.symbol)!.stopLoss!) / s.price) * 100
        : null;
      const priority = (s.label.includes("매수") ? 18 : 0) + Math.abs(s.newsScore) + (s.rsi != null && (s.rsi > 72 || s.rsi < 32) ? 14 : 0) + (distanceToStop != null && distanceToStop < 4 ? 20 : 0);
      return { ...s, priority, distanceToTarget, distanceToStop };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  const marketChecklist = [
    { title: "장 전", detail: "지수 선물·환율·금리 뉴스 확인", done: indices.length > 0 },
    { title: "장 중", detail: "관심종목 목표/손절 알림 점검", done: watch.some((w) => w.targetPrice || w.stopLoss) },
    { title: "마감 후", detail: "투자 일지에 매매 근거 기록", done: journal.length > 0 },
    { title: "리스크", detail: "현금·단일종목 비중 체크", done: portfolioHealth >= 65 },
  ];
  const scenarioEntry = Number(scenario.entry);
  const scenarioBudget = Number(scenario.budget);
  const scenarioStopPct = Math.abs(Number(scenario.stopPct));
  const scenarioTargetPct = Math.abs(Number(scenario.targetPct));
  const scenarioQty = Number.isFinite(scenarioEntry) && scenarioEntry > 0 && Number.isFinite(scenarioBudget) ? Math.floor(scenarioBudget / scenarioEntry) : 0;
  const scenarioCost = scenarioQty * (Number.isFinite(scenarioEntry) ? scenarioEntry : 0);
  const scenarioLoss = scenarioCost * (Number.isFinite(scenarioStopPct) ? scenarioStopPct / 100 : 0);
  const scenarioGain = scenarioCost * (Number.isFinite(scenarioTargetPct) ? scenarioTargetPct / 100 : 0);
  const scenarioRR = scenarioLoss > 0 ? scenarioGain / scenarioLoss : 0;
  const anchorRec = recs[0];
  const anchorSymbol = anchorRec?.symbol ?? signals[0]?.symbol ?? "NVDA";
  const buyCount = recs.filter((r) => r.label.includes("매수")).length;
  const sellCount = recs.filter((r) => r.label.includes("매도")).length;
  const avgRecScore = recs.length ? Math.round(recs.reduce((sum, r) => sum + r.score, 0) / recs.length) : 0;
  const marketBias = buyCount > sellCount ? "RISK-ON" : sellCount > buyCount ? "RISK-OFF" : "NEUTRAL";
  const headlineText = newsItems[0]?.title ?? brief?.summary ?? "실시간 시장 뉴스 대기 중";
  const tape = [
    ...indices.map((i) => `${i.label} ${i.changePercent >= 0 ? "▲" : "▼"}${Math.abs(i.changePercent).toFixed(2)}%`),
    ...recs.slice(0, 5).map((r) => `${r.symbol} ${r.label} ${r.score}점`),
  ];

  return (
    <div className="app">
      {/* ── Topbar ── */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">SM</div>
          <div>
            <h1>STOCK MASTER Terminal</h1>
            <p>Live market desk · AI signal engine · global news monitor</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {uid ? (
            <span className="btn on" style={{ cursor: "default" }}>👤 {uid}
              <span onClick={logout} style={{ cursor: "pointer", marginLeft: 6, color: "var(--text-dim)" }} title="로그아웃">✕</span>
            </span>
          ) : (
            <span style={{ display: "flex", gap: 6 }}>
              <input className="input" value={idInput} onChange={(e) => setIdInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="내 아이디" style={{ width: 120 }} />
              <button className="btn" onClick={login}>입장</button>
            </span>
          )}
          <button className={`btn ${live ? "on" : ""}`} onClick={() => setLive((v) => !v)}>
            <span className={live ? "pulse" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: live ? "var(--up)" : "var(--text-faint)", display: "inline-block" }} />
            {live ? `실시간 · ${countdown}s` : "실시간 OFF"}
          </button>
          <button className="btn" onClick={() => load()} disabled={busy === "load"}>{busy === "load" ? "갱신 중…" : "↻"}</button>
        </div>
      </div>

      <div className="market-tape" aria-label="실시간 시장 티커">
        <span className="tape-label">LIVE MARKET</span>
        <div className="tape-track">
          <div className="tape-run">
            {[...tape, ...tape].map((item, idx) => <span key={`${item}-${idx}`}>{item}</span>)}
          </div>
        </div>
      </div>

      <nav className="tabbar" aria-label="대시보드 탭">
        {TABS.map((tab) => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            <span>{tab.label}</span>
            <small>{tab.hint}</small>
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
      <div className="broadcast">
        <div className="desk-main">
          <div className="desk-kicker">
            <span className={live ? "live-dot" : "live-dot off"} />
            뉴욕 증시 브리핑
          </div>
          <div className="desk-headline">{headlineText}</div>
          <div className="desk-subline">
            {anchorRec ? `${anchorRec.name}(${anchorRec.symbol})가 ${anchorRec.score}점으로 ${recMarket} 추천 1순위입니다.` : "추천 엔진이 시장 데이터를 스캔하고 있습니다."}
          </div>
          <div className="terminal-chart">
            <div className="chart-top">
              <div>
                <div className="chart-symbol">{anchorSymbol}</div>
                <div className="faint">6개월 캔들 · MA20/MA60 · 볼린저밴드</div>
              </div>
              <div className="chart-badges">
                <span className="terminal-pill">{marketBias}</span>
                {anchorRec && <span className={`badge ${labelClass(anchorRec.label)}`}>{anchorRec.label}</span>}
              </div>
            </div>
            <StockChart symbol={anchorSymbol} />
          </div>
        </div>
        <aside className="desk-side">
          <div className="side-panel">
            <div className="panel-title">시장 온도</div>
            <div className="bias-meter">
              <div className="bias-value">{avgRecScore}</div>
              <div>
                <div className="bias-label">{marketBias}</div>
                <div className="faint">AI 추천 평균 점수</div>
              </div>
            </div>
            <div className="meter-line"><div style={{ width: `${scorePct(avgRecScore)}%` }} /></div>
            <div className="bias-stats">
              <span>매수 {buyCount}</span>
              <span>매도 {sellCount}</span>
              <span>갱신 {updated || "대기"}</span>
            </div>
          </div>
          <div className="side-panel">
            <div className="panel-title">Global Pulse</div>
            <div className="pulse-list">
              {indices.slice(0, 5).map((i, idx) => {
                const up = i.changePercent >= 0;
                return (
                  <div key={i.symbol} className="pulse-row">
                    <div>
                      <strong>{i.label}</strong>
                      <span>{i.price.toLocaleString("ko-KR", { maximumFractionDigits: i.currency === "KRW" ? 0 : 2 })}</span>
                    </div>
                    <MiniSpark seed={idx + Math.round(Math.abs(i.changePercent) * 10)} up={up} />
                    <b className={up ? "up" : "down"}>{up ? "+" : ""}{i.changePercent.toFixed(2)}%</b>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="side-panel news-desk">
            <div className="panel-title">News Wire</div>
            {(newsItems.length ? newsItems.slice(0, 4) : [{ title: "오늘자 생성 버튼을 누르면 경제 뉴스 브리핑이 표시됩니다.", source: "STOCK MASTER", link: "#", favicon: "" }]).map((n, idx) => (
              <a key={idx} href={n.link} target={n.link === "#" ? undefined : "_blank"} rel="noreferrer">
                <span>{String(idx + 1).padStart(2, "0")}</span>
                <div>{n.title}<small>{n.source}</small></div>
              </a>
            ))}
          </div>
        </aside>
      </div>
        </>
      )}

      {/* ── Pro Desk: 자동 브리핑 / 비교 / 위험 / 레이더 / 일지 ── */}
      {activeTab === "pro" && (
      <div className="section prodesk">
        <div className="sec-head">
          <h2 className="sec-title"><span className="ico">🧠</span> Pro Desk</h2>
          <div className="sec-actions">
            <button className="btn sm" onClick={loadInsights} disabled={insightsBusy}>{insightsBusy ? "분석 중…" : "브리핑 재생성"}</button>
            <button className="btn sm" onClick={openHtmlReport}>HTML REPORT</button>
          </div>
        </div>

        <div className="progrid planner-grid">
          <div className="pro-panel">
            <div className="panel-title">데일리 운용 체크리스트</div>
            <div className="check-cards">
              {marketChecklist.map((item) => (
                <div key={item.title} className={item.done ? "done" : ""}>
                  <b>{item.done ? "완료" : "대기"}</b>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pro-panel scenario-panel">
            <div className="panel-title">매매 시나리오 계산기</div>
            <div className="scenario-form">
              <input className="input" value={scenario.symbol} onChange={(e) => setScenario((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))} placeholder="종목" />
              <input className="input" value={scenario.entry} onChange={(e) => setScenario((p) => ({ ...p, entry: e.target.value }))} placeholder="진입가" inputMode="decimal" />
              <input className="input" value={scenario.budget} onChange={(e) => setScenario((p) => ({ ...p, budget: e.target.value }))} placeholder="투입금" inputMode="decimal" />
              <input className="input" value={scenario.stopPct} onChange={(e) => setScenario((p) => ({ ...p, stopPct: e.target.value }))} placeholder="손절%" inputMode="decimal" />
              <input className="input" value={scenario.targetPct} onChange={(e) => setScenario((p) => ({ ...p, targetPct: e.target.value }))} placeholder="목표%" inputMode="decimal" />
            </div>
            <div className="scenario-result">
              <div><span>예상 수량</span><b>{scenarioQty.toLocaleString("ko-KR")}</b></div>
              <div><span>투입 금액</span><b>{priceText(scenarioCost)}</b></div>
              <div><span>최대 손실</span><b className="down">-{priceText(scenarioLoss)}</b></div>
              <div><span>목표 이익</span><b className="up">+{priceText(scenarioGain)}</b></div>
              <div><span>손익비</span><b>{scenarioRR ? `${scenarioRR.toFixed(2)}R` : "-"}</b></div>
            </div>
          </div>
        </div>

        <div className="pro-panel universal-panel">
          <div className="universal-head">
            <div>
              <div className="panel-title">전체 종목 검색 & 분석 리포트</div>
              <p className="faint">Yahoo Finance 심볼 기준으로 미국/한국/일본/홍콩 등 대부분의 종목을 바로 분석합니다.</p>
            </div>
            <div className="universal-search">
              <input
                className="input"
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyzeAnySymbol()}
                placeholder="예: NVDA, 005930.KS, 7203.T, 0700.HK"
              />
              <button className="btn sm" onClick={() => analyzeAnySymbol()} disabled={symbolBusy}>{symbolBusy ? "분석 중…" : "분석"}</button>
            </div>
          </div>
          <div className="symbol-examples">
            {["NVDA", "AAPL", "TSLA", "005930.KS", "000660.KS", "7203.T", "0700.HK"].map((s) => (
              <button key={s} className="btn sm" onClick={() => analyzeAnySymbol(s)}>{s}</button>
            ))}
          </div>
          {symbolError && <div className="risk-alert high" style={{ marginTop: 10 }}><b>ERR</b><div><strong>분석 실패</strong><span>{symbolError}</span></div></div>}
          {symbolAnalysis && (
            <div className="universal-result">
              <div className="universal-score">
                <span className={`badge ${labelClass(symbolAnalysis.label)}`}>{symbolAnalysis.label}</span>
                <strong>{symbolAnalysis.score}점</strong>
                <em>{symbolAnalysis.name} · {symbolAnalysis.symbol}</em>
              </div>
              <div className="universal-metrics">
                <div><span>현재가</span><b>{priceText(symbolAnalysis.price)}</b></div>
                <div><span>RSI</span><b>{symbolAnalysis.rsi?.toFixed(0) ?? "-"}</b></div>
                <div><span>뉴스</span><b>{symbolAnalysis.newsLabel} {signed(symbolAnalysis.newsScore)}</b></div>
                <div><span>추세</span><b>{symbolAnalysis.trend}</b></div>
                <div><span>변동성</span><b>{symbolAnalysis.volatility.toFixed(1)}%</b></div>
                <div><span>목표/손절</span><b>{priceText(symbolAnalysis.levels.target)} / {priceText(symbolAnalysis.levels.stop)}</b></div>
              </div>
              <div className="universal-actions">
                <button className="btn sm" onClick={() => addWatch(symbolAnalysis.symbol, symbolAnalysis.market)}>+ 워치리스트</button>
                <button className="btn sm" onClick={() => { setCompareInput(symbolAnalysis.symbol); setCompareRows([symbolAnalysis]); }}>비교표로 보기</button>
                <button className="btn sm" onClick={() => openSymbolReport(symbolAnalysis.symbol)}>분석 REPORT</button>
              </div>
              <div className="universal-bottom">
                <div>
                  <div className="blk-title">분석 이유</div>
                  <ul className="why">{symbolAnalysis.reasons.slice(0, 4).map((r, idx) => <li key={idx}>{r}</li>)}</ul>
                </div>
                <div>
                  <div className="blk-title">뉴스 영향</div>
                  <div className="impact-list slim">
                    {symbolAnalysis.news.slice(0, 3).map((n, idx) => (
                      <a key={idx} href={n.link} target="_blank" rel="noreferrer">
                        <span className={`impact ${n.label === "호재" ? "up" : n.label === "악재" ? "down" : ""}`}>{n.label ?? "중립"} {signed(n.impact ?? 0)}</span>
                        <div>{n.title}<small>{n.source}</small></div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="progrid">
          <div className="pro-panel briefing-panel">
            <div className="panel-title">오늘의 투자 브리핑</div>
            {insights ? (
              <>
                <div className="briefing-hero">
                  <div>
                    <div className="faint">{new Date(insights.briefing.generatedAt).toLocaleString("ko-KR")}</div>
                    <h3>{insights.briefing.title}</h3>
                    <p>시장 분위기 <b>{insights.briefing.mood}</b> · 주요 지수 평균 {insights.briefing.indexAvg.toFixed(2)}%</p>
                  </div>
                  <span className="terminal-pill">{insights.briefing.mood}</span>
                </div>
                <div className="action-list">
                  {insights.briefing.actions.map((a, idx) => <div key={idx}>{a}</div>)}
                </div>
                <div className="focus-strip">
                  {insights.briefing.focus.slice(0, 4).map((s) => (
                    <div key={s.symbol}>
                      <strong>{s.symbol}</strong>
                      <span className={`badge ${labelClass(s.label)}`}>{s.label}</span>
                      <em>{s.score}점 · 목표 {priceText(s.levels.target)}</em>
                    </div>
                  ))}
                </div>
              </>
            ) : <span className="spin">브리핑 분석 대기 중…</span>}
          </div>

          <div className="pro-panel alert-panel">
            <div className="panel-title">관심종목 위험 알림</div>
            <div className="alert-list">
              {insights?.riskAlerts.length ? insights.riskAlerts.map((a, idx) => (
                <div key={`${a.symbol}-${idx}`} className={`risk-alert ${a.severity.toLowerCase()}`}>
                  <b>{a.severity}</b>
                  <div><strong>{a.symbol} · {a.title}</strong><span>{a.detail}</span></div>
                </div>
              )) : <span className="spin">현재 강한 위험 알림은 없습니다.</span>}
            </div>
          </div>

          <div className="pro-panel rebalance-panel">
            <div className="panel-title">포트폴리오 리밸런싱 추천</div>
            <p className="muted" style={{ marginTop: 0 }}>{insights?.rebalance.summary ?? "분석 대기 중…"}</p>
            <div className="action-list compact">
              {(insights?.rebalance.suggestions ?? []).map((s, idx) => <div key={idx}>{s}</div>)}
            </div>
          </div>

          <div className="pro-panel radar-panel">
            <div className="panel-title">실시간 시장 레이더</div>
            <div className="radar-tabs">
              <div>
                <b>급등락</b>
                {(insights?.radar.movers ?? []).slice(0, 4).map((r) => (
                  <span key={r.symbol}>{r.symbol} <em className={r.changePercent >= 0 ? "up" : "down"}>{r.changePercent.toFixed(1)}%</em></span>
                ))}
              </div>
              <div>
                <b>거래량</b>
                {(insights?.radar.volumeSpikes ?? []).slice(0, 4).map((r) => (
                  <span key={r.symbol}>{r.symbol} <em>{r.volumeRatio.toFixed(1)}x</em></span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pro-panel compare-panel">
          <div className="compare-head">
            <div>
              <div className="panel-title">종목 비교 모드</div>
              <p className="faint">점수, RSI, 뉴스 감성, 추세, 변동성, 목표가, 백테스트를 한 번에 비교합니다.</p>
            </div>
            <div className="compare-controls">
              <input className="input" value={compareInput} onChange={(e) => setCompareInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCompare()} />
              <button className="btn sm" onClick={runCompare} disabled={compareBusy}>{compareBusy ? "비교 중…" : "비교"}</button>
            </div>
          </div>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead><tr><th>종목</th><th>판단</th><th>점수</th><th>RSI</th><th>뉴스</th><th>추세</th><th>변동성</th><th>목표/손절</th><th>백테스트</th></tr></thead>
              <tbody>
                {compareRows.map((r) => (
                  <tr key={r.symbol}>
                    <td><strong>{r.symbol}</strong><span>{r.name}</span></td>
                    <td><span className={`badge ${labelClass(r.label)}`}>{r.label}</span></td>
                    <td>{r.score}<small>기술 {r.techScore} / 뉴스 {signed(r.newsScore)}</small></td>
                    <td>{r.rsi?.toFixed(0) ?? "-"}</td>
                    <td>{r.newsLabel}<small>{r.news[0] ? `${r.news[0].label ?? "중립"} ${signed(r.news[0].impact ?? 0)}` : "-"}</small></td>
                    <td>{r.trend}</td>
                    <td>{r.volatility.toFixed(1)}%</td>
                    <td>{priceText(r.levels.target)}<small className="down">손절 {priceText(r.levels.stop)}</small></td>
                    <td>{r.backtest ? `${r.backtest.winRate.toFixed(0)}%` : "-"}<small>{r.backtest ? `MDD ${r.backtest.maxDrawdownPct.toFixed(1)}%` : "데이터 부족"}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="progrid lower">
          <div className="pro-panel news-impact">
            <div className="panel-title">뉴스 영향도 점수</div>
            <div className="impact-list">
              {(compareRows[0]?.news ?? insights?.briefing.focus[0]?.news ?? []).slice(0, 5).map((n, idx) => (
                <a key={idx} href={n.link} target="_blank" rel="noreferrer">
                  <span className={`impact ${n.label === "호재" ? "up" : n.label === "악재" ? "down" : ""}`}>{n.label ?? "중립"} {signed(n.impact ?? 0)}</span>
                  <div>{n.title}<small>{n.reason ?? n.source}</small></div>
                </a>
              ))}
              {!compareRows[0]?.news?.length && !insights?.briefing.focus[0]?.news?.length && <span className="spin">뉴스 분석 대기 중…</span>}
            </div>
          </div>

          <div className="pro-panel journal-panel">
            <div className="panel-title">투자 일지 & 실수 패턴</div>
            <div className="journal-stats">
              <span>기록 {journalStats.total}</span>
              <span>손실/후회 키워드 {journalStats.loss}</span>
              <span>계획 부족 {journalStats.noPlan}</span>
            </div>
            <div className="journal-form">
              <input className="input" placeholder="종목" value={journalForm.symbol} onChange={(e) => setJournalForm((p) => ({ ...p, symbol: e.target.value }))} />
              <select className="input" value={journalForm.action} onChange={(e) => setJournalForm((p) => ({ ...p, action: e.target.value }))}>
                <option>매수</option><option>매도</option><option>관망</option><option>손절</option>
              </select>
              <input className="input" placeholder="매매 이유" value={journalForm.reason} onChange={(e) => setJournalForm((p) => ({ ...p, reason: e.target.value }))} />
              <input className="input" placeholder="결과/느낀점" value={journalForm.result} onChange={(e) => setJournalForm((p) => ({ ...p, result: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addJournal()} />
              <button className="btn sm" onClick={addJournal}>기록</button>
            </div>
            <div className="journal-list">
              {journal.slice(0, 5).map((j) => (
                <div key={j.id}>
                  <strong>{j.symbol} · {j.action}</strong>
                  <span>{j.reason}</span>
                  <small>{j.result || "결과 미입력"} · {new Date(j.date).toLocaleDateString("ko-KR")}</small>
                  <button onClick={() => deleteJournal(j.id)}>×</button>
                </div>
              ))}
              {!journal.length && <span className="spin">첫 매매 이유를 기록해보세요.</span>}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Hero: 포트폴리오 ── */}
      {activeTab === "portfolio" && (
        <>
      <div className="section">
        <div className="hero">
          <div className="tile accent">
            <div className="k">시드머니 (편집)</div>
            <div className="seedrow">
              <input className="input" value={seedEdit} onChange={(e) => setSeedEdit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveSeed()} inputMode="numeric" style={{ width: "100%" }} />
              <button className="btn sm" onClick={saveSeed}>저장</button>
            </div>
          </div>
          <div className="tile"><div className="k">총 평가금액</div><div className="v">{pf ? won(pf.totalValue) : "—"}</div></div>
          <div className="tile"><div className="k">평가손익</div><div className={`v ${pnlUp ? "up" : "down"}`}>{pf ? (pnlUp ? "+" : "") + won(pf.totalPnl) : "—"}</div></div>
          <div className="tile"><div className="k">수익률</div><div className={`v ${pnlUp ? "up" : "down"}`}>{pf ? `${pnlUp ? "+" : ""}${pf.totalPnlPercent.toFixed(1)}%` : "—"}</div></div>
        </div>
      </div>

      <div className="section">
        <div className="portfolio-health">
          <div className="health-score">
            <div className="panel-title">포트폴리오 건강 점수</div>
            <div className="health-ring" style={{ ["--score" as string]: `${portfolioHealth}%` }}>
              <strong>{portfolioHealth}</strong>
              <span>{portfolioVerdict}</span>
            </div>
          </div>
          <div className="health-body">
            <div className="health-metrics">
              <div><span>현금 비중</span><b>{cashRatio.toFixed(1)}%</b></div>
              <div><span>보유 평가</span><b>{won(holdingValue)}</b></div>
              <div><span>최대 비중</span><b>{topWeight.toFixed(1)}%</b></div>
              <div><span>손실 종목</span><b>{lossCount}개</b></div>
            </div>
            <div className="allocation-bars">
              {(allocations.length ? allocations.slice(0, 5) : [{ symbol: "현금", weight: cashRatio, marketValue: pf?.cashBalance ?? 0 }]).map((h) => (
                <div key={h.symbol}>
                  <span>{h.symbol}</span>
                  <div><i style={{ width: `${clamp(h.weight, 0, 100)}%` }} /></div>
                  <b>{h.weight.toFixed(1)}%</b>
                </div>
              ))}
            </div>
            <div className="health-notes">
              {portfolioChecklist.map((item, idx) => <span key={idx}>{item}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── 보유종목 ── */}
      <div className="section">
        <div className="sec-head">
          <h2 className="sec-title"><span className="ico">💼</span> 보유종목</h2>
          <span className="faint">{pf?.holdings.length ?? 0}개 · 현금 {pf ? won(pf.cashBalance) : "—"}</span>
        </div>
        <div className="card">
          <div className="import-panel">
            <div className="import-head">
              <div>
                <div className="panel-title">토스증권 사진 자동 입력</div>
                <p className="faint">보유종목 화면 캡처를 올리면 OCR로 종목·수량·평단 후보를 만들고, 확인 후 포트폴리오에 추가합니다.</p>
              </div>
              <label className={`btn sm ${importBusy ? "on" : ""}`}>
                {importBusy ? "인식 중…" : "사진 업로드"}
                <input type="file" accept="image/*" onChange={(e) => importTossImage(e.target.files?.[0])} hidden disabled={importBusy} />
              </label>
            </div>
            <div className="import-tools">
              <textarea
                className="input import-text"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="사진 인식이 애매하면 토스 보유종목 화면의 텍스트를 붙여넣고 '텍스트 분석'을 눌러주세요."
              />
              <div className="import-actions">
                <button className="btn sm" onClick={() => setImportRows(parseTossHoldings(importText))} disabled={!importText.trim() || importBusy}>텍스트 분석</button>
                <button className="btn sm" onClick={addImportRow}>직접 행 추가</button>
                <button className="btn sm on" onClick={addImportedHoldings} disabled={!importRows.length || importBusy}>후보 일괄 추가</button>
              </div>
            </div>
            {importRows.length > 0 && (
              <div className="import-table">
                <div className="import-table-head"><span>심볼</span><span>시장</span><span>수량</span><span>평단가</span><span>원문</span><span /></div>
                {importRows.map((row, idx) => (
                  <div key={`${row.symbol}-${idx}`} className="import-row">
                    <input className="input" value={row.symbol} onChange={(e) => updateImportRow(idx, { symbol: e.target.value.toUpperCase() })} placeholder="NVDA" />
                    <input className="input" value={row.market} onChange={(e) => updateImportRow(idx, { market: e.target.value.toUpperCase() })} placeholder="US" />
                    <input className="input" value={row.qty} onChange={(e) => updateImportRow(idx, { qty: e.target.value })} inputMode="decimal" placeholder="수량" />
                    <input className="input" value={row.avgBuyPrice} onChange={(e) => updateImportRow(idx, { avgBuyPrice: e.target.value })} inputMode="decimal" placeholder="평단" />
                    <span className="import-raw">{row.raw}</span>
                    <button className="btn sm" onClick={() => removeImportRow(idx)}>삭제</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 70px 90px 110px auto", gap: 8, marginBottom: 12 }}>
            <input className="input" value={holdingForm.symbol} onChange={(e) => setHoldingForm((p) => ({ ...p, symbol: e.target.value }))} placeholder="심볼" />
            <input className="input" value={holdingForm.market} onChange={(e) => setHoldingForm((p) => ({ ...p, market: e.target.value.toUpperCase() }))} placeholder="시장" />
            <input className="input" value={holdingForm.qty} onChange={(e) => setHoldingForm((p) => ({ ...p, qty: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addHolding()} placeholder="수량" inputMode="decimal" />
            <input className="input" value={holdingForm.avgBuyPrice} onChange={(e) => setHoldingForm((p) => ({ ...p, avgBuyPrice: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addHolding()} placeholder="평단가" inputMode="decimal" />
            <button className="btn" onClick={addHolding}>+ 추가</button>
          </div>
          <div style={{ display: "grid", gap: 0 }}>
            {pf?.holdings.map((h) => {
              const edit = holdingEdits[h.id] ?? { qty: String(h.qty), avgBuyPrice: String(h.avgBuyPrice) };
              const up = h.pnl >= 0;
              return (
                <div key={h.id} className="hold-row" style={{ gridTemplateColumns: "1.2fr 84px 104px 110px 130px auto", marginTop: 9 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{h.symbol}</div>
                    <div className="faint">{h.market} · 현재 {h.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} {h.currency}</div>
                  </div>
                  <input className="input" value={edit.qty} onChange={(e) => setHoldingEdits((p) => ({ ...p, [h.id]: { ...edit, qty: e.target.value } }))} inputMode="decimal" style={{ padding: "6px 8px", fontSize: 12 }} />
                  <input className="input" value={edit.avgBuyPrice} onChange={(e) => setHoldingEdits((p) => ({ ...p, [h.id]: { ...edit, avgBuyPrice: e.target.value } }))} inputMode="decimal" style={{ padding: "6px 8px", fontSize: 12 }} />
                  <div className="muted" style={{ fontSize: 12 }}>{won(h.marketValue)}</div>
                  <div className={up ? "up" : "down"} style={{ fontSize: 12 }}>{up ? "+" : ""}{won(h.pnl)} · {up ? "+" : ""}{h.pnlPercent.toFixed(1)}%</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn sm" onClick={() => saveHolding(h)}>저장</button>
                    <button className="btn sm" onClick={() => removeHolding(h.id)}>삭제</button>
                  </div>
                </div>
              );
            })}
            {pf && !pf.holdings.length && <span className="spin" style={{ marginTop: 6 }}>아직 보유종목이 없습니다.</span>}
          </div>
        </div>
      </div>

      {/* ── 리스크 + 알림 ── */}
      <div className="section">
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span className="faint">리스크</span>
          {RISKS.map((r) => (<button key={r} className={`btn sm ${risk === r ? "active" : ""}`} onClick={() => changeRisk(r)}>{r}형</button>))}
          <div className="sec-actions">
            <span className="faint">{updated && `갱신 ${updated}`}</span>
            <button className="btn sm" onClick={runCheck} disabled={busy === "check"}>{busy === "check" ? "점검 중…" : "🔔 신호 점검·알림"}</button>
          </div>
          <div style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 13, marginTop: 2 }}>
            <span className="faint">알림 채널</span>
            {([["notifyEmail", "📧 이메일"], ["notifyKakao", "💬 카카오"], ["notifyPush", "📱 푸시"]] as const).map(([k, label]) => (
              <button key={k} className={`btn sm ${settings[k] ? "on" : ""}`} onClick={() => toggleChannel(k)}>{settings[k] ? "● " : "○ "}{label}</button>
            ))}
            <button className="btn sm" onClick={testNotify} disabled={busy === "test"} style={{ marginLeft: "auto" }}>{busy === "test" ? "보내는 중…" : "테스트 알림 보내기"}</button>
          </div>
        </div>
      </div>
        </>
      )}

      {/* ── 세계 증시 ── */}
      {activeTab === "overview" && (
      <div className="section">
        <div className="sec-head"><h2 className="sec-title"><span className="ico">🌍</span> 세계 증시</h2></div>
        <div className="idxgrid">
          {indices.map((i) => { const up = i.changePercent >= 0; return (
            <div key={i.symbol} className="idx">
              <div className="k">{i.label}</div>
              <div className="v">{i.price.toLocaleString("ko-KR", { maximumFractionDigits: i.currency === "KRW" ? 0 : 2 })}</div>
              <div className={`d ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(i.changePercent).toFixed(2)}%</div>
            </div>); })}
        </div>
      </div>
      )}

      {/* ── 국가별 추천 ── */}
      {activeTab === "recommend" && (
      <div className="section">
        <div className="sec-head">
          <h2 className="sec-title"><span className="ico">📈</span> 국가별 종목 추천</h2>
          <div className="sec-actions">
            {REC_MARKETS.map((m) => { const meta = MARKET_META[m]; return (
              <button key={m} className={`btn sm ${recMarket === m ? "active" : ""}`} onClick={() => setRecMarket(m)}>{meta.flag} {meta.label}</button>); })}
            <button className="btn sm" onClick={downloadRecommendationReport} disabled={!recs.length || recBusy}>REPORT 저장</button>
          </div>
        </div>
        {recs[0] && (
          <div className="recommend-brief">
            <div>
              <div className="faint">오늘의 1순위 후보</div>
              <div className="recommend-lead">{recs[0].name} <span>{recs[0].symbol}</span></div>
              <div className="muted">{recs[0].summary} 목표가 {priceText(recs[0].levels.target)}, 손절가 {priceText(recs[0].levels.stop)} 기준으로 관리합니다.</div>
            </div>
            <div className="recommend-score">
              <span className={`badge ${labelClass(recs[0].label)}`}>{recs[0].label}</span>
              <strong>{recs[0].score}점</strong>
            </div>
          </div>
        )}
        <div className="recgrid">
          {recs.slice(0, 6).map((r) => {
            const inWatch = watch.some((w) => w.symbol === r.symbol);
            const open = openRecs.has(r.symbol);
            return (
              <div key={r.symbol} className={`reccard ${open ? "open" : ""}`}>
                <div className="rec-top" onClick={() => toggleRec(r.symbol)}>
                  <div><div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div><div className="faint">{r.symbol} · 종합 {r.score}점 · 신뢰도 {r.confidence}</div></div>
                  <span className={`badge ${labelClass(r.label)}`}>{r.label}</span>
                </div>
                <div className="rec-scorebar">
                  <div style={{ width: `${scorePct(r.score)}%` }} />
                </div>
                <div className="muted" style={{ fontSize: 11.5, margin: "9px 0", lineHeight: 1.5 }}>{r.summary}</div>
                <div className="rec-metrics">
                  <span>현재 {priceText(r.price)}</span>
                  <span>목표 {priceText(r.levels.target)}</span>
                  <span>손절 {priceText(r.levels.stop)}</span>
                </div>
                {open && (
                  <div className="rec-detail">
                    <div className="rec-split">
                      <div>
                        <div className="blk-title">추천 이유</div>
                        <ul className="why">{r.strengths.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
                      </div>
                      <div>
                        <div className="blk-title">주의할 점</div>
                        <ul className="why">{r.risks.map((x, idx) => <li key={idx}>{x}</li>)}</ul>
                      </div>
                    </div>
                    <div className="planbox">
                      <div><span>진입</span><strong>{priceText(r.price)}</strong></div>
                      <div><span>목표</span><strong className="up">{priceText(r.levels.target)} (+{r.levels.targetPct.toFixed(1)}%)</strong></div>
                      <div><span>손절</span><strong className="down">{priceText(r.levels.stop)} ({r.levels.stopPct.toFixed(1)}%)</strong></div>
                    </div>
                    <div className="checklist">
                      {r.checklist.map((x, idx) => <div key={idx}>✓ {x}</div>)}
                    </div>
                    {r.news.length > 0 && (
                      <div className="newslist compact">
                        {r.news.slice(0, 2).map((n, idx) => (
                          <a key={idx} className="newsitem" href={n.link} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={n.favicon || "https://www.google.com/s2/favicons?domain=news.google.com&sz=64"} alt="" width={16} height={16} />
                            <span style={{ fontSize: 12, lineHeight: 1.4 }}>{n.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn sm" onClick={() => toggleRec(r.symbol)} style={{ flex: 1, justifyContent: "center" }}>{open ? "접기" : "분석 보기"}</button>
                  <button className="btn sm" onClick={() => addWatch(r.symbol, recMarket)} disabled={inWatch} style={{ flex: 1, justifyContent: "center" }}>{inWatch ? "이미 추가됨" : "+ 워치리스트"}</button>
                </div>
              </div>
            );
          })}
          {recBusy && <span className="spin">스캔 중…</span>}
          {!recs.length && !recBusy && <span className="spin">추천 결과가 없습니다.</span>}
        </div>
      </div>
      )}

      {/* ── 관심종목 신호 ── */}
      {activeTab === "signals" && (
      <div className="section">
        <div className="sec-head">
          <h2 className="sec-title"><span className="ico">🚦</span> 관심종목 · 매매 신호</h2>
          <div className="sec-actions">
            <input className="input" value={newSym} onChange={(e) => setNewSym(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addWatch()} placeholder="심볼 추가 (예: GOOGL, 7203.T)" style={{ width: 210 }} />
            <button className="btn sm" onClick={() => addWatch()}>+ 추가</button>
          </div>
        </div>

        <div className="signal-digest">
          <div className="digest-main">
            <div className="panel-title">오늘 우선 확인 보드</div>
            <div className="digest-list">
              {actionableSignals.length ? actionableSignals.map((s) => (
                <button key={s.symbol} onClick={() => setExpanded((prev) => new Set(prev).add(s.symbol))}>
                  <strong>{s.symbol}</strong>
                  <span className={`badge ${labelClass(s.label)}`}>{s.label}</span>
                  <em>{s.priority}pt · RSI {s.rsi?.toFixed(0) ?? "-"}</em>
                  <small>{s.distanceToStop != null ? `손절까지 ${s.distanceToStop.toFixed(1)}%` : s.distanceToTarget != null ? `목표까지 ${s.distanceToTarget.toFixed(1)}%` : `${s.newsLabel} 뉴스`}</small>
                </button>
              )) : <span className="spin">관심종목을 추가하면 우선순위를 계산합니다.</span>}
            </div>
          </div>
          <div className="digest-side">
            <div><span>매수 후보</span><b>{signals.filter((s) => s.label.includes("매수")).length}</b></div>
            <div><span>과열 RSI</span><b>{signals.filter((s) => (s.rsi ?? 0) >= 70).length}</b></div>
            <div><span>악재 뉴스</span><b>{signals.filter((s) => s.newsScore < 0).length}</b></div>
          </div>
        </div>

        {groups.map(([market, rows]) => { const meta = MARKET_META[market] ?? MARKET_META.ETC; return (
          <div key={market} style={{ marginBottom: 18 }}>
            <div className="faint" style={{ fontWeight: 600, color: "var(--text-dim)", marginBottom: 9 }}>{meta.flag} {meta.label} · {rows.length}</div>
            <div className="siggrid">
              {rows.map((s) => {
                const open = expanded.has(s.symbol);
                const w = watch.find((x) => x.symbol === s.symbol);
                const links = externalLinks(s.symbol);
                const gc = GRADE_CLASS[s.type] ?? "g-hold";
                return (
                  <div key={s.symbol} className={`sig ${gc} ${open ? "open" : ""}`} onClick={() => toggle(s.symbol)}>
                    <div className="sig-head">
                      <div>
                        <div className="sig-name">{s.name}{s.name !== s.symbol && <span className="tk">{s.symbol}</span>}</div>
                        <div className="sig-sub">{s.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} · 종합 {s.score}점 <span className="faint">(차트 {s.techScore}{s.newsScore >= 0 ? "+" : ""}{s.newsScore} 뉴스)</span>{s.rsi != null ? ` · RSI ${s.rsi.toFixed(0)}` : ""}{w?.targetPrice ? ` · 🎯${w.targetPrice.toLocaleString("ko-KR")}` : ""}</div>
                      </div>
                      <div className="sig-right"><span className={`badge ${gc}`}>{s.label}</span><span className="caret">{open ? "▲" : "▼"}</span></div>
                    </div>
                    <div className="scorebar">
                      <div className="tick" />
                      <div className="dot" style={{ left: `${scorePct(s.score)}%`, background: GRADE_COLOR[s.type] ?? "#c2cad6" }} />
                    </div>
                    {open && (
                      <div className="detail" onClick={(e) => e.stopPropagation()}>
                        <div className="blk">
                          <div className="blk-title">📌 왜 {s.label}인가요?</div>
                          <ul className="why">{s.reasons.length ? s.reasons.map((r, idx) => <li key={idx}>{r}</li>) : <li className="muted">뚜렷한 신호 없음 (관망)</li>}</ul>
                        </div>
                        <div className="blk kidbox">
                          <div className="kid-head">🧒 쉽게 풀어서 설명하면</div>
                          <div style={{ fontSize: 12.5, marginBottom: 8 }}>{s.kid.headline}</div>
                          <ul className="kid-points">{s.kid.points.map((p, idx) => <li key={idx}>{p}</li>)}</ul>
                          <div className="kid-caveat">⚠️ {s.kid.caveat}</div>
                        </div>
                        <div className="blk chips">
                          {s.indicators.maTrend && <span className="chip">MA {s.indicators.maTrend}추세</span>}
                          {s.indicators.goldenCross && <span className="chip up">골든크로스</span>}
                          {s.indicators.deadCross && <span className="chip down">데드크로스</span>}
                          {s.indicators.macdState && <span className="chip">MACD {s.indicators.macdState}</span>}
                          {s.indicators.touchedLower && <span className="chip up">볼린저 하단</span>}
                          {s.indicators.touchedUpper && <span className="chip down">볼린저 상단</span>}
                          {s.rsi != null && <span className="chip">RSI {s.rsi.toFixed(0)}</span>}
                        </div>
                        {/* 추천 매도가 + 손절가 */}
                        <div className="blk">
                          <div className="blk-title">🎯 추천 매매가 (변동성 기반)</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                            <div style={{ flex: 1, minWidth: 130, background: "rgba(31,207,138,0.08)", border: "1px solid rgba(31,207,138,0.28)", borderRadius: 10, padding: "9px 11px" }}>
                              <div className="faint" style={{ color: "#3fdd9b" }}>목표 매도가 (익절)</div>
                              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{s.levels.target.toLocaleString("ko-KR")} <span className="up" style={{ fontSize: 12 }}>+{s.levels.targetPct.toFixed(1)}%</span></div>
                            </div>
                            <div style={{ flex: 1, minWidth: 130, background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.28)", borderRadius: 10, padding: "9px 11px" }}>
                              <div className="faint" style={{ color: "#ff6378" }}>손절가</div>
                              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{s.levels.stop.toLocaleString("ko-KR")} <span className="down" style={{ fontSize: 12 }}>{s.levels.stopPct.toFixed(1)}%</span></div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <span className="faint">내 알림:</span>
                            <input className="input" value={targetPct[s.symbol] ?? ""} onChange={(e) => setTargetPct((p) => ({ ...p, [s.symbol]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && saveTarget(s.symbol, s.price)} placeholder="익절%" inputMode="numeric" style={{ width: 64, padding: "6px 8px", fontSize: 12 }} />
                            <button className="btn sm" onClick={() => saveTarget(s.symbol, s.price)}>목표가</button>
                            <input className="input" value={stopPct[s.symbol] ?? ""} onChange={(e) => setStopPct((p) => ({ ...p, [s.symbol]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && saveStop(s.symbol, s.price)} placeholder="손절%" inputMode="numeric" style={{ width: 64, padding: "6px 8px", fontSize: 12 }} />
                            <button className="btn sm" onClick={() => saveStop(s.symbol, s.price)}>손절가</button>
                          </div>
                          {(w?.targetPrice || w?.stopLoss) && <div className="faint" style={{ marginTop: 6 }}>{w?.targetPrice ? `🎯 ${w.targetPrice.toLocaleString("ko-KR")}` : ""}{w?.stopLoss ? `  🛑 ${w.stopLoss.toLocaleString("ko-KR")}` : ""} 도달 시 알림</div>}
                        </div>
                        <div className="blk"><StockChart symbol={s.symbol} /></div>
                        <div className="blk"><BacktestPanel symbol={s.symbol} risk={risk} /></div>
                        {s.news.length > 0 && (
                          <div className="blk">
                            <div className="blk-title">📰 최신 뉴스 <span className={`badge ${s.newsLabel === "긍정" ? "success" : s.newsLabel === "부정" ? "danger" : "warning"}`}>{s.newsLabel}</span></div>
                            <div className="newslist">
                              {s.news.map((n, idx) => (
                                <a key={idx} className="newsitem" href={n.link} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={n.favicon || "https://www.google.com/s2/favicons?domain=news.google.com&sz=64"} alt="" width={16} height={16} />
                                  <span style={{ fontSize: 12, lineHeight: 1.4 }}>{n.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <a className="btn sm" href={links.investing} target="_blank" rel="noreferrer">Investing ↗</a>
                          <a className="btn sm" href={links.google} target="_blank" rel="noreferrer">구글 파이낸스 ↗</a>
                          <a className="btn sm" href={links.yahoo} target="_blank" rel="noreferrer">Yahoo ↗</a>
                          {w && <button className="btn sm" onClick={() => removeWatch(w.id)} style={{ marginLeft: "auto" }}>✕ 제거</button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>); })}
        {!signals.length && <div className="card"><span className="spin">{busy === "load" ? "신호 계산 중…" : "워치리스트가 비어 있습니다."}</span></div>}
      </div>
      )}

      {/* ── 뉴스 브리핑 ── */}
      {activeTab === "news" && (
      <div className="section">
        <div className="sec-head">
          <h2 className="sec-title"><span className="ico">📰</span> 일일 뉴스 브리핑</h2>
          <div className="sec-actions">
            <button className={`btn sm ${kidMode ? "active" : ""}`} onClick={() => setKidMode((v) => !v)}>{kidMode ? "🧒 초딩버전" : "🧑 일반버전"}</button>
            <button className="btn sm" onClick={genBrief} disabled={busy === "brief"}>{busy === "brief" ? "생성 중…" : "오늘자 생성"}</button>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          {brief ? <pre className="brief">{kidMode ? (brief.kidMd ?? "초딩 버전이 없습니다. ‘오늘자 생성’을 눌러주세요.") : brief.contentMd}</pre>
            : <span className="spin">아직 브리핑이 없습니다. ‘오늘자 생성’을 눌러보세요. (매일 07:00 자동 생성은 cron으로 연결)</span>}
        </div>
        {newsItems.length > 0 && (
          <div className="newsgrid">
            {newsItems.map((n, idx) => (
              <a key={idx} className="newsitem" href={n.link} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={n.favicon || "https://www.google.com/s2/favicons?domain=news.google.com&sz=64"} alt="" width={20} height={20} />
                <div><div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{n.title}</div><div className="faint" style={{ marginTop: 3 }}>{n.source} ↗</div></div>
              </a>
            ))}
          </div>
        )}
      </div>
      )}

      <p className="disclaimer">※ 모든 신호·뉴스는 투자 참고용이며 최종 책임은 본인에게 있습니다. 매매는 토스증권 등 본인 계좌에서 직접 진행하세요. 데이터: Yahoo Finance · Google News(무료).</p>
    </div>
  );
}
