# AI 전자책 생성기

주제 하나만 입력하면 Claude AI가 목차부터 챕터 내용까지 자동으로 작성해주는 오픈소스 웹앱입니다.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-바로%20사용하기-blue)](https://ebook-generator-eight.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-후원하기-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/rocinante1475)

**[👉 지금 바로 사용하기](https://ebook-generator-eight.vercel.app)**

---

## 기능

- **목차 자동 생성** — 주제 입력 시 Claude AI가 챕터 구조를 자동으로 설계
- **챕터 내용 자동 작성** — 각 챕터를 순차적으로 스트리밍 생성
- **다운로드 지원** — 마크다운(.md) 및 PDF 미리보기 출력
- **개인정보 보호** — 사용자 본인의 Claude API 키 사용 (BYOK), 서버에 내용 저장 없음
- **완전 무료 & 오픈소스** — MIT 라이선스

---

## 사용 방법

1. [Anthropic Console](https://console.anthropic.com)에서 Claude API 키 발급
2. [ebook-generator-eight.vercel.app](https://ebook-generator-eight.vercel.app) 접속
3. API 키 입력 후 주제 작성
4. 목차 확인 및 편집
5. 전체 내용 생성 → 다운로드

---

## 로컬 실행

```bash
git clone https://github.com/rocinante1475/ebook-generator.git
cd ebook-generator
npm install
```

`.env.local` 파일 생성:

```
ANTHROPIC_API_KEY=여기에_API_키_입력
```

```bash
npm run dev
# http://localhost:3000
```

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router) + TypeScript |
| AI | Claude API (claude-sonnet-4-6) |
| 스타일 | Tailwind CSS |
| 배포 | Vercel |

**핵심 구현 방식:**
- 프롬프트 체이닝: 목차를 JSON으로 먼저 생성 → 각 챕터 생성 시 전체 목차를 컨텍스트로 주입 → 챕터 간 일관성 유지
- 스트리밍 응답: ReadableStream으로 실시간 생성 표시

---

## 기여

PR과 이슈 환영합니다.

```bash
git checkout -b feature/기능명
git commit -m 'feat: 기능 설명'
git push origin feature/기능명
# PR 생성
```

---

## 후원

이 프로젝트가 유용하셨다면 커피 한 잔으로 응원해주세요 ☕

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rocinante1475)

---

## 라이선스

MIT © [rocinante1475](https://github.com/rocinante1475)
