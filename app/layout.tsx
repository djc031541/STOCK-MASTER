import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STOCK MASTER Terminal",
  description: "실시간 세계 증시 모니터링, AI 종목 추천, 뉴스 감성 분석 대시보드",
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
