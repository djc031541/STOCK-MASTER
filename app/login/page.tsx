"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "로그인에 실패했습니다");
      return;
    }
    router.replace(params.get("next") || "/");
  }

  return (
    <main className="authShell">
      <form className="authCard" onSubmit={submit}>
        <div>
          <h1>GlobalTrade Advisor</h1>
          <p>배포 보호 비밀번호를 입력하세요.</p>
        </div>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="APP_AUTH_PASSWORD"
        />
        {error && <div className="authError">{error}</div>}
        <button className="btn" disabled={busy || !password}>
          {busy ? "확인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="authShell"><div className="spin">로그인 준비 중...</div></main>}>
      <LoginForm />
    </Suspense>
  );
}
