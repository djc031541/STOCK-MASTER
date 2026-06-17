# 자동화 (cron) 설정

신호 점검과 일일 뉴스 브리핑은 외부 스케줄러가 API를 주기적으로 호출하면 자동화됩니다.
앱은 로컬 dev 또는 배포 서버가 떠 있어야 합니다.

## macOS / Linux crontab

```bash
crontab -e
```

```cron
# 매일 07:00 — 일일 뉴스 브리핑 생성
0 7 * * *   curl -s -X POST http://localhost:3000/api/news/today >/dev/null

# 평일 장중 10분마다 — 신호 점검 + 알림 (등급 변화 시에만 발송)
*/10 9-16 * * 1-5   curl -s -X POST http://localhost:3000/api/signals/check >/dev/null
```

## 실제 알림 채널 켜기 (.env)

키를 넣으면 해당 채널로 실제 발송됩니다. 없으면 콘솔 로그로만 출력(개발용).

```bash
# 이메일 (둘 중 하나)
SMTP_URL=...
RESEND_API_KEY=...
# 카카오 알림톡
KAKAO_API_KEY=...
# 웹/모바일 푸시
FCM_SERVER_KEY=...
# 뉴스 AI 요약 (없으면 헤드라인 그대로)
ANTHROPIC_API_KEY=...
# 네이버 뉴스 (없으면 Google News RSS 사용)
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

> 클라우드 배포(Vercel 등) 시: Vercel Cron 으로 위 두 엔드포인트를 스케줄링하고,
> Yahoo 시세는 데이터센터 IP 차단 가능성이 있어 Finnhub/한국투자증권(KIS) 키 소스로 교체 권장.
