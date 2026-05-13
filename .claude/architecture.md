# 아키텍처 — 파일 구조 · 라우팅 · 렌더링

## 전체 파일 구조

```
src/
├── components/
│   ├── Icon.astro                    # 소형 SVG 아이콘 (사이드바·헤더·카드)
│   ├── GameIllustration.astro        # 대형 컬러 SVG 일러스트 (게임 카드 전용)
│   ├── games/
│   │   ├── GameRenderer.tsx          # lazy() 게임 컴포넌트 로더
│   │   ├── Sidebar.astro
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── GameMessage.tsx       # info/success/warning/error/hint 상태 메시지
│   │       ├── Input.tsx
│   │       └── ScoreDisplay.tsx
│   └── tools/
│       ├── ToolRenderer.tsx          # lazy() 툴 컴포넌트 로더
│       ├── Sidebar.astro
│       └── ui/
│           ├── Button.tsx
│           ├── CopyButton.tsx
│           ├── Input.tsx
│           ├── StatCard.tsx
│           └── Textarea.tsx
├── content/
│   ├── config.ts                     # 컬렉션 스키마 (수정하지 않음)
│   ├── docs/
│   │   ├── games/<slug>/ko.md
│   │   └── tools/<slug>/ko.md
│   ├── games/
│   │   ├── number-guesser.md
│   │   └── tic-tac-toe.md
│   └── tools/
│       ├── base64-encoder.md
│       ├── color-converter.md
│       ├── json-formatter.md
│       ├── password-generator.md
│       └── word-counter.md
├── games/
│   ├── lib/
│   │   ├── GameCanvas.tsx            # DPR-aware <canvas> 컴포넌트
│   │   ├── useGameLoop.ts            # requestAnimationFrame 루프 훅
│   │   └── useInput.ts               # 키보드(useKeys) + 터치(useSwipe) 훅
│   ├── number-guesser/NumberGuesser.tsx
│   └── tic-tac-toe/TicTacToe.tsx
├── i18n/
│   ├── en.ts                         # 타입 소스
│   ├── ko.ts
│   └── index.ts                      # 헬퍼 함수
├── layouts/
│   ├── GameLayout.astro
│   ├── LandingLayout.astro
│   └── ToolLayout.astro
├── pages/
│   ├── index.astro
│   ├── games/[slug].astro · index.astro
│   ├── tools/[slug].astro · index.astro
│   └── ko/
│       ├── index.astro
│       ├── games/[slug].astro · index.astro
│       └── tools/[slug].astro · index.astro
├── styles/
│   └── global.css                    # Fonts, 스크롤바, 기본 리셋
└── tools/
    ├── base64-encoder/Base64Encoder.tsx
    ├── color-converter/ColorConverter.tsx
    ├── json-formatter/JsonFormatter.tsx
    ├── password-generator/PasswordGenerator.tsx
    └── word-counter/WordCounter.tsx

public/
├── CNAME                            # ctrlcat.dev
├── favicon.svg · favicon-tool.svg · favicon-game.svg
```

---

## 라우팅

페이지 파일을 직접 만들 필요 없습니다. 콘텐츠 컬렉션에 `.md`를 추가하면 `[slug].astro`가 자동으로 페이지를 생성합니다.

| URL | 파일 |
|---|---|
| `/` | `pages/index.astro` |
| `/tools/` | `pages/tools/index.astro` |
| `/tools/<slug>/` | `pages/tools/[slug].astro` |
| `/games/` | `pages/games/index.astro` |
| `/games/<slug>/` | `pages/games/[slug].astro` |
| `/ko/` | `pages/ko/index.astro` |
| `/ko/tools/<slug>/` | `pages/ko/tools/[slug].astro` |
| `/ko/games/<slug>/` | `pages/ko/games/[slug].astro` |

---

## 컴포넌트 렌더링 파이프라인

```
content/tools/<slug>.md
  component: "word-counter/WordCounter"
    └─ ToolRenderer.tsx
         └─ import.meta.glob("/src/tools/**/*.tsx")
              └─ key: "word-counter/WordCounter"
                   └─ lazy(importFn) → <Suspense> → <WordCounter />
```

`component` 필드값이 glob key로 사용됩니다 (확장자 없음). 올바른 경로에 파일을 두면 자동으로 감지되므로 ToolRenderer/GameRenderer는 수정하지 않아도 됩니다.

---

## 문서 폴백 흐름 (KO 상세 페이지)

```
ko/tools/[slug].astro
  1. getEntry("docs", "tools/<slug>/ko") 시도
  2. 있으면 → KO 문서 렌더링
  3. 없으면 → 영어 content body 렌더링 (폴백)
```

게임도 동일: `ko/games/[slug].astro` → `docs/games/<slug>/ko`

---

## 파일 명명 규칙

| 대상 | 패턴 | 예시 |
|---|---|---|
| slug | kebab-case | `base64-encoder` |
| 컴포넌트 파일 | PascalCase.tsx | `Base64Encoder.tsx` |
| 컴포넌트 디렉토리 | `src/tools/<slug>/` | `src/tools/base64-encoder/` |
| content 파일 | `src/content/tools/<slug>.md` | `base64-encoder.md` |
| `component` frontmatter | `<slug>/<ComponentName>` | `"base64-encoder/Base64Encoder"` |
| `icon` frontmatter | slug와 동일 | `"base64-encoder"` |
