# Firebase App Hosting 배포 가이드

이 앱은 **Next.js(SSR) + PostgreSQL** 로 클라우드 배포되도록 준비돼 있습니다.
App Hosting 은 **GitHub 저장소를 연결하면 push 할 때마다 자동 빌드·배포**됩니다.

> ⚠️ 아래 1~6단계 중 **계정 로그인·결제·시크릿 입력**은 본인만 할 수 있습니다(보안).
> 코드/설정은 이미 준비돼 있으니 명령어만 따라 하시면 됩니다.

---

## 0. 준비물
- Google 계정 + **Firebase 프로젝트** (Blaze 종량제 — App Hosting 은 무료 한도 내 거의 0원이지만 카드 등록 필요)
- **GitHub 저장소** (App Hosting 이 여기서 빌드)
- **무료 PostgreSQL** — [Neon](https://neon.tech) 추천 (또는 Supabase)

---

## 1. 데이터베이스 만들기 (Neon)
1. neon.tech 가입 → 프로젝트 생성 (리전: AWS Tokyo 권장)
2. 연결 문자열 2개 복사:
   - **Pooled**(`...-pooler...`) → `DATABASE_URL`
   - **Direct** → `DIRECT_URL`
3. 로컬 `.env` 에 붙여넣기:
   ```
   DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require&pgbouncer=true"
   DIRECT_URL="postgresql://.../neondb?sslmode=require"
   ```
4. 스키마 적용 + 시드:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
5. (선택) 로컬 확인: `npm run dev` → http://localhost:3000

---

## 2. GitHub 에 코드 올리기
```bash
git init && git add -A && git commit -m "deploy ready"
git branch -M main
git remote add origin https://github.com/<본인>/stock-master.git
git push -u origin main
```

---

## 3. Firebase CLI 로그인
```bash
npm i -g firebase-tools
firebase login
firebase projects:create   # 또는 콘솔에서 프로젝트 생성 후 결제(Blaze) 연결
```

---

## 4. App Hosting 백엔드 생성
```bash
firebase init apphosting
```
- 리전: **asia-northeast3 (서울)** 권장
- GitHub 저장소/브랜치(main) 연결
- 루트 디렉터리: `/` (이미 `apphosting.yaml` 있음)

---

## 5. 시크릿(DB URL) 등록
앱이 런타임에 DB 에 접속하려면 시크릿을 Secret Manager 에 넣어야 합니다:
```bash
firebase apphosting:secrets:set DATABASE_URL
firebase apphosting:secrets:set DIRECT_URL
# (선택) firebase apphosting:secrets:set ANTHROPIC_API_KEY  등
```
`apphosting.yaml` 의 `env` 가 이 이름들을 참조합니다(이미 설정됨).

---

## 6. 배포
```bash
git push        # main 에 push 하면 App Hosting 이 자동 빌드·배포
```
콘솔의 App Hosting 화면에서 진행 상황과 배포 URL 을 확인할 수 있습니다.

---

## 7. 자동화(cron) — Cloud Scheduler
배포 URL 을 `https://<your-app>` 라 하면:
```bash
# 매일 07:00 뉴스 브리핑
gcloud scheduler jobs create http news-brief --schedule "0 7 * * *" \
  --uri "https://<your-app>/api/news/today" --http-method POST --time-zone "Asia/Seoul"
# 장중 10분마다 신호 점검·알림
gcloud scheduler jobs create http signal-check --schedule "*/10 9-16 * * 1-5" \
  --uri "https://<your-app>/api/signals/check" --http-method POST --time-zone "Asia/Seoul"
```

---

## ⚠️ 꼭 알아둘 점

### 시세 데이터 (Yahoo)
- 코드를 **curl → 실패 시 Node fetch 폴백**으로 바꿔서 클라우드에서도 시도합니다.
- DB(Postgres) 캐시가 인스턴스 간 공유되어 Yahoo 호출을 크게 줄여줍니다.
- 다만 **GCP 데이터센터 IP 는 Yahoo 가 간헐적으로 차단(429)** 할 수 있습니다.
  - 증상: 시세/신호가 안 뜸 → 로그에 "Yahoo 호출 실패".
  - 해결: 키 기반 소스로 교체 (예: **Finnhub** 무료 키). `lib/datasources/` 에 provider 를
    추가하고 `getQuote/getCandles` 를 바꾸면 됩니다. (원하시면 작업해 드립니다.)

### 외부 접근 보호 (선택)
- `APP_AUTH_PASSWORD` 시크릿을 설정하면 `/login` 비밀번호 게이트가 켜집니다.
- 개인 페이지 기능(상단바 아이디)은 그대로 동작합니다.

### 비용
- App Hosting/Cloud Run: 트래픽 적으면 월 0~수백 원. min instances=0(콜드스타트 허용)로 설정됨.
- Neon: 무료 티어로 충분.

---

## 대안: Vercel (더 간단)
Firebase 가 번거로우면 Next.js 는 Vercel 이 가장 쉽습니다:
`vercel` CLI 또는 GitHub 연결 → 환경변수(DATABASE_URL 등)만 넣으면 끝.
curl 이슈도 Vercel 환경에선 fetch 폴백으로 대부분 동작합니다.
