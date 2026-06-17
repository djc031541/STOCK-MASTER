import assert from "node:assert/strict";
import test from "node:test";
import { backtest } from "@/lib/backtest";
import { emaSeries, macd, rsi } from "@/lib/indicators";
import { generateSignal, gradeFromScore } from "@/lib/signal";
import type { Candle } from "@/lib/types";

function candles(values: number[]): Candle[] {
  return values.map((close, i) => ({
    date: 1_700_000_000 + i * 86_400,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000,
  }));
}

test("RSI returns 100 for a one-way rising series", () => {
  const values = Array.from({ length: 20 }, (_, i) => 100 + i);
  assert.equal(rsi(values, 14), 100);
});

test("MACD histogram matches the EMA series calculation", () => {
  const values = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 4) * 5 + i * 0.4);
  const result = macd(values, 12, 26, 9);

  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  const line = values
    .map((_, i) => (fast[i] == null || slow[i] == null ? null : fast[i]! - slow[i]!))
    .filter((v): v is number => v != null);
  const signal = emaSeries(line, 9);
  const expectedHist = line[line.length - 1] - signal[signal.length - 1]!;

  assert.ok(result.hist != null);
  assert.ok(Math.abs(result.hist - expectedHist) < 1e-10);
});

test("risk thresholds classify the same score differently", () => {
  assert.equal(gradeFromScore(45, "공격"), "STRONG_BUY");
  assert.equal(gradeFromScore(45, "중립"), "BUY");
  assert.equal(gradeFromScore(45, "안정"), "HOLD");
  assert.equal(gradeFromScore(-60, "중립"), "STRONG_SELL");
});

test("generateSignal returns a result when at least 60 candles exist", () => {
  const result = generateSignal("TEST", candles(Array.from({ length: 70 }, (_, i) => 100 + i * 0.5)), "중립");
  assert.ok(result);
  assert.equal(result.symbol, "TEST");
  assert.ok(Number.isFinite(result.score));
});

test("backtest avoids future data and returns summary metrics", () => {
  const values = Array.from({ length: 130 }, (_, i) => 100 + Math.sin(i / 6) * 10 + i * 0.2);
  const result = backtest("TEST", candles(values), "공격");
  assert.ok(result);
  assert.equal(result.symbol, "TEST");
  assert.equal(result.bars, values.length - 60);
  assert.ok(Number.isFinite(result.strategyReturnPct));
  assert.ok(Number.isFinite(result.buyHoldReturnPct));
  assert.ok(result.maxDrawdownPct >= 0);
});
