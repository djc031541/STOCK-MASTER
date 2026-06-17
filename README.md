# GlobalTrade Advisor

세계 증시를 모니터링하고 매수·매도 타이밍 신호 + 일일 경제뉴스를 **알림으로** 제공하는
개인 트레이딩 어시스턴트. 매매는 사용자가 본인 계좌(토스증권 등)에서 직접 합니다.
(자동매매 X — 알림 전용)

## 스택 (전부 무료·키 불필요로 시작)

| 층 | 선택 |
|----|------|
| 프레임워크 | Next.js 15 (App Router) + TypeScript |
| 시세 데이터 | Yahoo Finance 공개 API (키 불필요) |
| DB | SQLite + Prisma (로컬 파일) |
| 신호 엔진 | 자체 구현 (RSI · 이동평균 · MACD · 볼린저밴드) |

> 참고: Yahoo는 Node fetch를 TLS 지문으로 429 차단해서, 시스템 `curl`로 받아옵니다
> (`lib/datasources/yahoo.ts`). 긴 Chrome User-Agent 문자열도 차단되므로 짧은 UA를 씁니다.
> 클라우드 배포 시에는 Finnhub/한국투자증권(KIS) 등 키 기반 소스로 교체하세요.

## 실행

```bash
npm install
npx prisma generate && npx prisma db push   # SQLite DB 생성
npm run dev                                  # http://localhost:3000
```

## 구조

```
app/
  page.tsx                     대시보드 (시드머니/리스크/지수/신호)
  api/market/indices/route.ts  세계 지수 + 환율
  api/quote/[symbol]/route.ts  개별 시세
  api/signals/route.ts         워치리스트 매매 신호
lib/
  datasources/yahoo.ts         무료 시세 소스 (curl 기반)
  indicators.ts                RSI/MA/MACD/볼린저 계산
  signal.ts                    지표 → 점수(-100~100) → 등급화
  markets.ts                   대상 심볼 목록
  types.ts / prisma.ts
prisma/schema.prisma           데이터 구조 (User/Portfolio/Holding/Watchlist/
                               PriceDaily/Signal/NewsBrief)
```

## 신호 로직 요약

각 종목 일봉으로 4개 지표를 계산 → 가중 점수 합산(-100~+100) → 리스크 성향별 임계값으로
🟢강한매수 / 🟢매수 / 🟡관망 / 🔴매도 / 🔴강한매도 로 등급화.

| 지표 | 가중치 | 매수 / 매도 조건 |
|------|-------|----------------|
| 이동평균(20/60) | 30% | 골든크로스 / 데드크로스 |
| RSI(14) | 25% | 30↓ 과매도 / 70↑ 과매수 |
| MACD(12,26,9) | 25% | 시그널선 상향/하향 돌파 |
| 볼린저밴드(20,2σ) | 20% | 하단 터치 / 상단 도달 |

## 추가 API

| 엔드포인트 | 설명 |
|-----------|------|
| `GET/POST /api/watchlist`, `DELETE /api/watchlist/:id` | 워치리스트 CRUD (DB 연동) |
| `GET/POST /api/portfolio` | 실시간 평가손익 / 시드·리스크 설정 |
| `GET /api/backtest?symbol=&risk=&range=` | 신호 전략 백테스팅 (vs 매수후보유) |
| `GET/POST /api/news/today` | 일일 뉴스 브리핑 조회/생성 |
| `POST /api/signals/check` | 신호 점검 + 등급변화 시 알림(중복 방지) |

- 뉴스: Google News RSS(키없음) / `NAVER_*` 키 있으면 네이버. 요약: `ANTHROPIC_API_KEY` 있으면 Claude, 없으면 헤드라인.
- 알림(실연동): 이메일 `SMTP_URL`(Gmail 등) / `RESEND_API_KEY`, 카카오 `KAKAO_ACCESS_TOKEN`(나에게 보내기). 키 없으면 콘솔 로그(이메일은 개발 중 Ethereal 테스트 메일). 설정법 → [NOTIFY.md](NOTIFY.md)
- `POST /api/notify/test` — 켜둔 채널로 테스트 알림(대시보드 “테스트 알림 보내기” 버튼).
- 자동화(cron) 설정은 [CRON.md](CRON.md) 참고.

## 다음 단계 후보
- 실제 알림 채널 어댑터 구현(현재 스텁) + 푸시 구독 UI
- 종목 차트(캔들+지표 오버레이), 백테스팅 결과 화면
- Postgres 전환 + 멀티유저 인증

> ※ 모든 신호는 투자 참고용이며 최종 책임은 본인에게 있습니다.
