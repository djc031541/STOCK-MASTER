import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlobalTrade Advisor",
  description: "세계 증시 모니터링 + 매매 신호 알림 (무료 데이터 기반)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
