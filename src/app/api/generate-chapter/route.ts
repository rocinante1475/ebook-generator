import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '여기에_API_키를_입력하세요') {
    return Response.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }

  const { topic, audience, tone, chapterNumber, totalChapters, chapterTitle, chapterDescription } =
    await request.json();

  const toneGuide: Record<string, string> = {
    conversational: '친근하고 대화하듯 쓰세요. 독자에게 직접 말을 거는 느낌으로.',
    professional: '전문적이고 격식 있게 쓰세요. 비즈니스 독자를 위한 어조로.',
    academic: '학술적이고 체계적으로 쓰세요. 근거와 논리를 강조해서.',
    practical: '실용적이고 행동 중심으로 쓰세요. 구체적인 단계와 예시 위주로.',
  };

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: [
      {
        role: 'user',
        content: `전자책 "${topic}"의 챕터 ${chapterNumber}/${totalChapters}를 작성해주세요.

챕터 제목: ${chapterTitle}
챕터 설명: ${chapterDescription}
대상 독자: ${audience || '일반 독자'}
문체: ${toneGuide[tone] || toneGuide.conversational}

다음 구조로 마크다운 형식으로 작성하세요:
1. 매력적인 도입부 (독자가 왜 이 챕터를 읽어야 하는지)
2. ## 소제목으로 나뉜 2~4개의 본문 섹션 (각 섹션에 실용적인 예시 포함)
3. ### 소소제목으로 세부 내용 구분
4. 간결한 챕터 요약

챕터 전체 내용을 지금 바로 작성하세요:`,
      },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(event.delta.text));
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
