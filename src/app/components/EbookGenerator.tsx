'use client';

import { useState } from 'react';

interface Chapter {
  chapterNumber: number;
  title: string;
  description: string;
  estimatedPages: number;
}

type Tone = 'conversational' | 'professional' | 'academic' | 'practical';

interface FormData {
  topic: string;
  audience: string;
  pageCount: number;
  tone: Tone;
}

type Step = 1 | 2 | 3 | 4;

const TONE_OPTIONS: { value: Tone; label: string; desc: string }[] = [
  { value: 'conversational', label: '대화체', desc: '친근하고 쉽게' },
  { value: 'professional', label: '전문적', desc: '비즈니스 어조' },
  { value: 'academic', label: '학술적', desc: '논리·근거 중심' },
  { value: 'practical', label: '실용적', desc: '행동·단계 중심' },
];

const STEP_LABELS = ['정보 입력', '목차 검토', '내용 생성', '완료'];

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr />')
    .split('\n\n')
    .map((block) => {
      if (/^<(h[1-6]|hr)/.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');
}

export default function EbookGenerator() {
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>({
    topic: '',
    audience: '',
    pageCount: 50,
    tone: 'conversational',
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [generatedContent, setGeneratedContent] = useState<Record<number, string>>({});
  const [isLoadingToc, setIsLoadingToc] = useState(false);
  const [currentlyGenerating, setCurrentlyGenerating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedCount = Object.keys(generatedContent).length;
  const progress = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0;
  const totalChars = Object.values(generatedContent).reduce((a, b) => a + b.length, 0);

  const handleGenerateToc = async () => {
    if (!formData.topic.trim()) {
      setError('주제를 입력해주세요.');
      return;
    }
    setIsLoadingToc(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-toc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '목차 생성에 실패했습니다.');
      setChapters(data.chapters);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setIsLoadingToc(false);
    }
  };

  const handleGenerateAllChapters = async () => {
    setStep(3);
    setGeneratedContent({});
    for (const chapter of chapters) {
      setCurrentlyGenerating(chapter.chapterNumber);
      try {
        const res = await fetch('/api/generate-chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: formData.topic,
            audience: formData.audience,
            tone: formData.tone,
            chapterNumber: chapter.chapterNumber,
            totalChapters: chapters.length,
            chapterTitle: chapter.title,
            chapterDescription: chapter.description,
          }),
        });
        if (!res.body) throw new Error('스트리밍 응답 없음');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let content = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          const num = chapter.chapterNumber;
          setGeneratedContent((prev) => ({ ...prev, [num]: content }));
        }
      } catch (e) {
        const num = chapter.chapterNumber;
        setGeneratedContent((prev) => ({
          ...prev,
          [num]: `[오류] ${e instanceof Error ? e.message : '챕터 생성 실패'}`,
        }));
      }
    }
    setCurrentlyGenerating(null);
    setStep(4);
  };

  const handleDownloadMarkdown = () => {
    let md = `# ${formData.topic}\n\n`;
    if (formData.audience) md += `**대상 독자**: ${formData.audience}\n\n`;
    md += `---\n\n## 목차\n\n`;
    chapters.forEach((ch) => {
      md += `${ch.chapterNumber}. ${ch.title}\n`;
    });
    md += `\n---\n\n`;
    chapters.forEach((ch) => {
      md += `# 챕터 ${ch.chapterNumber}: ${ch.title}\n\n`;
      md += generatedContent[ch.chapterNumber] || '(내용 없음)';
      md += `\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.topic.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPrintView = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.');
      return;
    }

    const chaptersHtml = chapters
      .map(
        (ch) => `
        <div class="chapter">
          <h1>챕터 ${ch.chapterNumber}: ${ch.title}</h1>
          ${markdownToHtml(generatedContent[ch.chapterNumber] || '(내용 없음)')}
        </div>`,
      )
      .join('\n');

    const tocHtml = chapters
      .map((ch) => `<li>${ch.chapterNumber}. ${ch.title}</li>`)
      .join('\n');

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${formData.topic}</title>
  <style>
    body {
      font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 48px 40px;
      line-height: 1.9;
      color: #1a1a1a;
      font-size: 15px;
    }
    .cover { text-align: center; padding: 80px 0; border-bottom: 2px solid #e0e0e0; margin-bottom: 40px; }
    .cover h1 { font-size: 2.4em; margin-bottom: 16px; }
    .cover .meta { color: #666; font-size: 0.95em; }
    .toc { margin-bottom: 40px; }
    .toc h2 { font-size: 1.4em; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; }
    .toc ol { padding-left: 20px; line-height: 2.2; }
    .chapter { page-break-before: always; padding-top: 20px; }
    .chapter:first-of-type { page-break-before: auto; }
    h1 { font-size: 1.8em; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 24px; color: #111; }
    h2 { font-size: 1.35em; color: #222; margin-top: 36px; border-left: 4px solid #0070f3; padding-left: 12px; }
    h3 { font-size: 1.1em; color: #333; margin-top: 24px; }
    p { margin: 14px 0; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 28px 0; }
    strong { color: #111; }
    .print-btn {
      position: fixed; top: 20px; right: 20px;
      background: #0070f3; color: white;
      border: none; padding: 10px 20px; border-radius: 8px;
      font-size: 14px; cursor: pointer; font-family: inherit;
    }
    @media print {
      .print-btn { display: none; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">PDF로 저장 (Ctrl+P)</button>
  <div class="cover">
    <h1>${formData.topic}</h1>
    <div class="meta">${formData.audience ? `대상 독자: ${formData.audience}` : ''}</div>
  </div>
  <div class="toc">
    <h2>목차</h2>
    <ol>${tocHtml}</ol>
  </div>
  ${chaptersHtml}
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI 전자책 생성기</h1>
            <p className="text-xs text-gray-400 mt-0.5">Claude AI로 전문적인 전자책을 자동 생성합니다</p>
          </div>
          <a
            href="https://ko-fi.com/rocinante1475"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-[#FF5E5B] text-white text-sm font-medium rounded-lg hover:bg-[#e54e4b] transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.148 4.198 1 7.5 1c1.768 0 3.668.888 4.5 2.216C12.832 1.888 14.732 1 16.5 1 19.8 1 23 3.148 23 7.191c0 4.105-5.37 8.863-11 14.402z"/>
            </svg>
            후원하기
          </a>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-3 flex gap-2">
          {STEP_LABELS.map((label, i) => {
            const s = (i + 1) as Step;
            const isDone = step > s;
            const isCurrent = step === s;
            return (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    isCurrent ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isDone
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isDone ? '✓' : s}
                  </div>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-6 h-px ${step > s ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1: Input Form ── */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-7">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">전자책 기본 정보</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  주제 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData((p) => ({ ...p, topic: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateToc()}
                  placeholder="예: 퍼스널 브랜딩 완전 정복, 주식 투자 입문"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">대상 독자</label>
                <input
                  type="text"
                  value={formData.audience}
                  onChange={(e) => setFormData((p) => ({ ...p, audience: e.target.value }))}
                  placeholder="예: 직장인 30대, 창업 준비 중인 사람"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  목표 페이지 수:{' '}
                  <span className="text-blue-600 font-semibold">{formData.pageCount}p</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={200}
                  step={10}
                  value={formData.pageCount}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, pageCount: parseInt(e.target.value) }))
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>20p</span>
                  <span>200p</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">문체</label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormData((p) => ({ ...p, tone: opt.value }))}
                      className={`px-4 py-3 rounded-lg border text-left transition-colors ${
                        formData.tone === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateToc}
              disabled={isLoadingToc || !formData.topic.trim()}
              className="mt-7 w-full py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoadingToc ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  목차 생성 중...
                </span>
              ) : (
                '목차 생성하기 →'
              )}
            </button>
          </div>
        )}

        {/* ── Step 2: TOC Review ── */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">목차 검토</h2>
                <p className="text-xs text-gray-400 mt-0.5">제목을 클릭해 직접 편집할 수 있습니다</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded hover:bg-gray-100"
              >
                ← 돌아가기
              </button>
            </div>

            <div className="space-y-2 mb-7">
              {chapters.map((ch, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 border border-gray-100 rounded-lg hover:bg-gray-50 group"
                >
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {ch.chapterNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={ch.title}
                      onChange={(e) => {
                        const next = [...chapters];
                        next[i] = { ...next[i], title: e.target.value };
                        setChapters(next);
                      }}
                      className="w-full font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 -mx-1"
                    />
                    <p className="text-xs text-gray-400 mt-0.5 px-1">{ch.description}</p>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0 pt-1">~{ch.estimatedPages}p</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerateAllChapters}
              className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              전체 내용 생성 시작 ({chapters.length}개 챕터)
            </button>
          </div>
        )}

        {/* ── Step 3: Generating ── */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-7">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">내용 생성 중...</h2>
            <p className="text-sm text-gray-400 mb-6">Claude AI가 각 챕터를 작성하고 있습니다. 잠시 기다려주세요.</p>

            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>
                  {completedCount}/{chapters.length} 챕터 완료
                </span>
                <span className="font-medium text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {chapters.map((ch) => {
                const isDone = !!generatedContent[ch.chapterNumber];
                const isActive = currentlyGenerating === ch.chapterNumber;
                return (
                  <div
                    key={ch.chapterNumber}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : isDone
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    <span className="shrink-0 w-5 text-center">
                      {isDone ? '✓' : isActive ? (
                        <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : '○'}
                    </span>
                    <span className="flex-1 truncate">
                      챕터 {ch.chapterNumber}: {ch.title}
                    </span>
                    {isDone && (
                      <span className="text-xs opacity-60 shrink-0">
                        {generatedContent[ch.chapterNumber].length.toLocaleString()}자
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Summary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-lg">
                  ✓
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">전자책 생성 완료!</h2>
                  <p className="text-sm text-gray-400">
                    {chapters.length}개 챕터 · 총 {totalChars.toLocaleString()}자
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadMarkdown}
                  className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors text-sm"
                >
                  마크다운 다운로드 (.md)
                </button>
                <button
                  onClick={handleOpenPrintView}
                  className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  PDF 미리보기 / 저장
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">
                PDF는 미리보기 창에서 Ctrl+P → PDF로 저장 선택
              </p>
            </div>

            {/* Chapter Previews */}
            {chapters.map((ch) => (
              <div key={ch.chapterNumber} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">
                    챕터 {ch.chapterNumber}: {ch.title}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {(generatedContent[ch.chapterNumber] || '').length.toLocaleString()}자
                  </span>
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-4 border border-gray-100">
                  {generatedContent[ch.chapterNumber] || '내용 없음'}
                </pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
