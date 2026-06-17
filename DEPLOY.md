# 배포 초딩버전

이 앱은 `index.html` 하나로 올리는 앱이 아닙니다.
Next.js 서버 + SQLite DB가 같이 떠야 원래 기능이 전부 동작합니다.

## 제일 쉬운 추천

Railway 또는 Render에 올리세요.
Vercel은 SQLite 파일 DB 저장이 맞지 않아서 비추천입니다.

## 배포 설정값

Build command:

```bash
npm ci && npx prisma generate && npm run build
```

Start command:

```bash
npx prisma db push && npm run start
```

## 환경변수

Railway/Render에서 아래 값을 넣으세요.

```env
DATABASE_URL=file:/data/dev.db
APP_AUTH_PASSWORD=원하는비밀번호
APP_AUTH_SECRET=아무도모르는긴랜덤문자
NODE_ENV=production
```

이메일 알림을 쓰려면 추가:

```env
NOTIFY_EMAIL_TO=내이메일@example.com
SMTP_URL=smtps://...
```

## 꼭 필요한 저장공간

SQLite DB가 사라지지 않게 Volume/Disk를 붙이고, 경로를 `/data`로 설정하세요.
