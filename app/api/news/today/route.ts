import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { buildDailyBrief, getLatestBrief } from "@/lib/news";

// GET /api/news/today — 최신 브리핑 (없으면 안내)
export async function GET() {
  const brief = await getLatestBrief();
  if (!brief) {
    return NextResponse.json({
      ok: true,
      data: null,
      message: "아직 브리핑이 없습니다. POST로 생성하세요.",
    });
  }
  return NextResponse.json({ ok: true, data: brief });
}

// POST /api/news/today — 오늘 브리핑 생성(수동 트리거 / cron 에서 호출)
export async function POST() {
  try {
    const user = await getCurrentUser();
    const wl = await prisma.watchlist.findMany({ where: { userId: user.id } });
    const brief = await buildDailyBrief(wl.map((w) => w.symbol));
    return NextResponse.json({ ok: true, data: brief });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
