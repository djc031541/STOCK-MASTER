// 뉴스 헤드라인 → ① 일반 요약 ② 초딩 버전(쉬운 설명)
//   ANTHROPIC_API_KEY 있으면 Claude로, 없으면 규칙 기반 폴백.

import type { NewsItem } from "@/lib/datasources/news";

type Summaries = { summary: string; kid: string; usedAI: boolean };

async function withClaude(headlines: string[]): Promise<Summaries | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content:
              "다음 경제/증시 뉴스 헤드라인을 두 가지 버전으로 요약해줘.\n" +
              "반드시 아래 형식 그대로, 두 섹션을 '---'로 구분해서 출력:\n\n" +
              "[일반]\n한국 투자자 관점 핵심 3~4줄 (사실 위주)\n---\n" +
              "[초딩]\n초등학생도 이해할 수 있게 쉬운 말로 3~4줄. 어려운 경제용어는 비유로 풀어서.\n\n" +
              "헤드라인:\n" +
              headlines.map((h, i) => `${i + 1}. ${h}`).join("\n"),
          },
        ],
      }),
    });
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text?.trim();
    if (!text) return null;
    const [normal, kid] = text.split(/\n-{3,}\n/);
    return {
      summary: (normal || text).replace(/^\[일반\]\s*/i, "").trim(),
      kid: (kid || "").replace(/^\[초딩\]\s*/i, "").trim() || kidFallback(headlines),
      usedAI: true,
    };
  } catch {
    return null;
  }
}

function summaryFallback(items: NewsItem[]): string {
  if (!items.length) return "수집된 경제 뉴스가 없습니다.";
  return items.slice(0, 4).map((i) => `• ${i.title}`).join("\n");
}

// AI 없을 때의 초딩 버전: 헤드라인을 친근한 말로 감싸 안내
function kidFallback(headlines: string[]): string {
  if (!headlines.length) return "오늘은 전해줄 경제 소식이 없어요. 😊";
  const top = headlines.slice(0, 3).map((h) => `🔸 ${h}`).join("\n");
  return (
    "오늘 어른들이 이야기하는 경제 뉴스예요 👇\n" +
    top +
    "\n쉽게 말하면, 회사와 나라가 돈을 어떻게 벌고 쓰는지에 대한 이야기랍니다. " +
    "(AI 요약을 켜면 더 쉽게 풀어드려요!)"
  );
}

export async function summarizeNews(items: NewsItem[]): Promise<Summaries> {
  const headlines = items.map((i) => i.title).filter(Boolean);
  const ai = await withClaude(headlines);
  if (ai) return ai;
  return { summary: summaryFallback(items), kid: kidFallback(headlines), usedAI: false };
}
