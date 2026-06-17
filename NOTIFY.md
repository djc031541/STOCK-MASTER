# 알림 채널 연동 가이드

앱은 키가 없으면 **콘솔 로그**(이메일은 개발 중 Ethereal 테스트 메일)로 폴백합니다.
아래처럼 `.env`에 자격증명을 넣으면 실제 발송됩니다. 설정 후 대시보드의
**“테스트 알림 보내기”** 버튼으로 채널별 성공/실패를 바로 확인하세요.

---

## 📧 이메일

받는사람만 정하면 됩니다:
```bash
NOTIFY_EMAIL_TO=you@example.com
```

### 방법 A — Gmail SMTP (가장 간단)
1. 구글 계정 → 보안 → **2단계 인증** 켜기
2. **앱 비밀번호** 생성 (16자리)
3. `.env`에:
```bash
SMTP_URL=smtps://your@gmail.com:앱비밀번호16자리@smtp.gmail.com:465
```

### 방법 B — Resend (무료 3,000통/월)
1. resend.com 가입 → API Key 발급
2. `.env`에:
```bash
RESEND_API_KEY=re_xxxxx
# 도메인 인증 전이면 테스트 발신주소 사용 (본인 가입 이메일로만 수신 가능)
NOTIFY_EMAIL_FROM=onboarding@resend.dev
```

> 키를 아무것도 안 넣으면 개발 모드에서 **Ethereal 테스트 메일**로 보내고
> 미리보기 URL을 결과에 돌려줍니다 (실제 메일함으로는 안 감).

---

## 💬 카카오 “나에게 보내기” (무료)

카카오 알림톡(비즈메시지)은 사업자/유료라 부담이 큽니다. 대신 **메시지 API의
‘나에게 보내기’**(메모)를 쓰면 본인 카톡으로 무료 발송됩니다.

1. [카카오 디벨로퍼스](https://developers.kakao.com) → 애플리케이션 생성
2. **카카오 로그인** 활성화 + 동의항목 **`talk_message`(카카오톡 메시지 전송)** 추가
3. OAuth로 **access token** 발급 (scope에 `talk_message` 포함)
4. `.env`에:
```bash
KAKAO_ACCESS_TOKEN=발급받은_토큰
# 토큰 만료 자동갱신을 원하면(권장):
KAKAO_REFRESH_TOKEN=...
KAKAO_REST_KEY=앱_REST_API_키
```

> access token은 보통 몇 시간 후 만료됩니다. `KAKAO_REFRESH_TOKEN` + `KAKAO_REST_KEY`를
> 넣어두면 401 발생 시 앱이 자동으로 토큰을 갱신해 재발송합니다.

---

## 📱 푸시 (FCM) — 선택
웹/모바일 푸시는 FCM 프로젝트 + 서비스 워커가 필요해 현재 스텁입니다.
`FCM_SERVER_KEY`를 넣고 `lib/notify.ts`의 `sendPush`를 구현하면 연결됩니다.

---

## 동작 방식
- 대시보드 **알림 채널** 토글로 이메일/카카오/푸시 ON·OFF (DB 저장)
- 신호 점검(`/api/signals/check`)에서 **등급 변화 시에만** 켜둔 채널로 발송 (중복 방지)
- 방해금지 시간(기본 23~07시)엔 보류, 단 **손절가 도달은 긴급이라 항상 발송**
- 모든 채널 실패 시 콘솔 로그로 폴백
