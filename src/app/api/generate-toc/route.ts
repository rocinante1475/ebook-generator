import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { topic, audience, pageCount, tone } = await request.json();

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '여기에_API_키를_입력하세요') {
    return Response.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }

  const targetChapters = Math.max(3, Math.min(15, Math.round(pageCount / 10)));

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `전자책의 목차를 JSON 배열로 생성해주세요.

주제: ${topic}
대상 독자: ${audience || '일반 독자'}
예상 페이지 수: ${pageCount}페이지
문체: ${tone}
목표 챕터 수: ${targetChapters}개

다음 형식의 JSON 배열로만 응답하세요 (다른 텍스트 없이):
[
  {
    "chapterNumber": 1,
    "title": "챕터 제목",
    "description": "이 챕터에서 다루는 내용 한두 줄 요약",
    "estimatedPages": 숫자
  }
]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    return Response.json({ error: '예상치 못한 응답 형식' }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    const chapters = JSON.parse(jsonMatch ? jsonMatch[0] : content.text);
    return Response.json({ chapters });
  } catch {
    return Response.json({ error: 'JSON 파싱 실패', raw: content.text }, { status: 500 });
  }
}
