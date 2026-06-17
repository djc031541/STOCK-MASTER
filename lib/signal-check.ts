// 워치리스트 신호 점검 → 등급 변화 시에만 알림 (중복 방지)
//   + 목표가/손절가 도달 알림

import { prisma } from "@/lib/prisma";
import { getCandles } from "@/lib/datasources/yahoo";
import { generateSignal, SIGNAL_LABEL } from "@/lib/signal";
import { dispatch, isQuietHour, type NotifyChannel } from "@/lib/notify";
import type { RiskProfile } from "@/lib/types";

const ACTIONABLE = new Set(["STRONG_BUY", "BUY", "SELL", "STRONG_SELL"]);

export type CheckOutcome = {
  symbol: string;
  type: string;
  changed: boolean; // 직전 대비 등급 변화
  notified: boolean;
  reason: string;
};

export async function checkUserSignals(userId: string): Promise<CheckOutcome[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  const risk = (user.riskProfile as RiskProfile) || "중립";
  const watchlist = await prisma.watchlist.findMany({ where: { userId } });

  const hour = new Date().getHours();
  const quiet = isQuietHour(hour, user.quietFrom, user.quietTo);

  const channels: NotifyChannel[] = [];
  if (user.notifyPush) channels.push("push");
  if (user.notifyKakao) channels.push("kakao");
  if (user.notifyEmail) channels.push("email");
  if (!channels.length) channels.push("log");

  const outcomes: CheckOutcome[] = [];

  for (const w of watchlist) {
    try {
      const candles = await getCandles(w.symbol, "1y", "1d");
      const sig = generateSignal(w.symbol, candles, risk);
      if (!sig) {
        outcomes.push({ symbol: w.symbol, type: "N/A", changed: false, notified: false, reason: "데이터 부족" });
        continue;
      }

      // 직전 신호와 비교 (중복 방지)
      const last = await prisma.signal.findFirst({
        where: { symbol: w.symbol },
        orderBy: { createdAt: "desc" },
      });
      const changed = !last || last.type !== sig.type;

      // 목표가 / 손절가 도달 체크
      const price = sig.price;
      const hitTarget = w.targetPrice != null && price >= w.targetPrice;
      const hitStop = w.stopLoss != null && price <= w.stopLoss;
      const targetAlreadySent =
        hitTarget &&
        (await prisma.priceAlertEvent.findUnique({
          where: {
            watchlistId_kind_threshold: {
              watchlistId: w.id,
              kind: "TARGET",
              threshold: w.targetPrice!,
            },
          },
        }));
      const stopAlreadySent =
        hitStop &&
        (await prisma.priceAlertEvent.findUnique({
          where: {
            watchlistId_kind_threshold: {
              watchlistId: w.id,
              kind: "STOP",
              threshold: w.stopLoss!,
            },
          },
        }));
      const newTargetHit = hitTarget && !targetAlreadySent;
      const newStopHit = hitStop && !stopAlreadySent;

      let notified = false;
      let reason = "변화 없음";

      const shouldSignal = changed && ACTIONABLE.has(sig.type);

      if (shouldSignal || newTargetHit || newStopHit) {
        // 등급 변화/목표가는 방해금지 존중, 손절(hitStop)은 긴급이라 항상 발송
        const allowNow = !quiet || newStopHit;

        if (allowNow) {
          const label = SIGNAL_LABEL[sig.type].ko;
          const tone =
            sig.type.includes("BUY") ? "🟢" : sig.type.includes("SELL") ? "🔴" : "🟡";
          let title = `${tone} [${label}] ${w.symbol}`;
          let body = `현재가 ${price.toLocaleString("ko-KR")} · score ${sig.score}`;
          if (sig.indicators.rsi != null)
            body += ` · RSI ${sig.indicators.rsi.toFixed(0)}`;
          if (sig.reasons.length) body += `\n${sig.reasons.join(" · ")}`;
          if (newTargetHit) {
            title = `🎯 [목표가 도달] ${w.symbol}`;
            body = `목표가 ${w.targetPrice?.toLocaleString("ko-KR")} 도달 (현재 ${price.toLocaleString("ko-KR")})`;
          }
          if (newStopHit) {
            title = `🛑 [손절가 도달] ${w.symbol}`;
            body = `손절가 ${w.stopLoss?.toLocaleString("ko-KR")} 도달 (현재 ${price.toLocaleString("ko-KR")})`;
          }
          body += `\n※ 투자 참고용 정보이며 최종 책임은 본인에게 있습니다.`;

          await dispatch({ title, body, channels });
          notified = true;
          reason = newStopHit ? "손절가 도달" : newTargetHit ? "목표가 도달" : "등급 변화";
          if (newTargetHit) {
            await prisma.priceAlertEvent.create({
              data: { watchlistId: w.id, symbol: w.symbol, kind: "TARGET", threshold: w.targetPrice! },
            });
          }
          if (newStopHit) {
            await prisma.priceAlertEvent.create({
              data: { watchlistId: w.id, symbol: w.symbol, kind: "STOP", threshold: w.stopLoss! },
            });
          }
        } else {
          reason = "방해금지 시간(보류)";
        }
      } else if (hitTarget && targetAlreadySent) {
        reason = "목표가 이미 알림";
      } else if (hitStop && stopAlreadySent) {
        reason = "손절가 이미 알림";
      }

      // 등급이 바뀐 경우에만 신호 이력 저장 (중복 방지 기준점)
      if (changed) {
        await prisma.signal.create({
          data: {
            symbol: w.symbol,
            type: sig.type,
            score: sig.score,
            price,
            indicators: JSON.stringify(sig.indicators),
            sent: notified,
          },
        });
      }

      outcomes.push({ symbol: w.symbol, type: sig.type, changed, notified, reason });
    } catch (e) {
      outcomes.push({
        symbol: w.symbol,
        type: "ERR",
        changed: false,
        notified: false,
        reason: (e as Error).message,
      });
    }
  }

  return outcomes;
}
