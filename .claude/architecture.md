# 아키텍처 — 파일 구조 · 라우팅 · 렌더링

## 전체 파일 구조

```
src/
├── components/
│   ├── SeoHead.astro                 # <head> 공통: 메타, hreflang, og, 테마 초기화, 브라우저 언어 이동 스크립트
│   ├── ThemeToggleScript.astro       # 다크 모드 토글 버튼 동작
│   ├── DocArticle.astro              # 상세 페이지 본문 (KO 문서 → 영어 본문 폴백)
│   ├── Icon.astro                    # 소형 SVG 아이콘 (사이드바·헤더·카드)
│   ├── GameIllustration.astro        # 대형 컬러 SVG 일러스트 (게임 카드 전용)
│   ├── games/
│   │   ├── GameRenderer.tsx          # lazy() 게임 로더 + LangProvider
│   │   ├── GameShell.tsx             # 게임 틀: 음소거·전체 화면 버튼, SoundProvider
│   │   ├── SoundContext.tsx          # useSound(): 효과음 합성
│   │   ├── difficulty.ts             # 난이도 배지 색상 클래스
│   │   ├── Sidebar.astro
│   │   └── ui/                       # Button · GameMessage · Input · ScoreDisplay
│   └── tools/
│       ├── ToolRenderer.tsx          # lazy() 툴 로더 + LangProvider
│       ├── Sidebar.astro
│       └── ui/                       # Button · CopyButton · Input · Notice · StatCard · Textarea
├── content/
│   ├── config.ts                     # 컬렉션 스키마 (수정하지 않음)
│   ├── docs/{tools,games}/<slug>/ko.md
│   ├── games/<slug>.md
│   └── tools/<slug>.md
├── games/
│   ├── lib/
│   │   ├── GameCanvas.tsx            # DPR 대응 <canvas>
│   │   ├── useGameLoop.ts            # requestAnimationFrame 루프 훅
│   │   ├── useInput.ts               # 키보드(useKeys) + 터치(useSwipe) 훅
│   │   ├── useBestScore.ts           # localStorage 최고 기록 훅
│   │   └── messages.ts               # 게임 공통 UI 문자열 (common.en / common.ko)
│   └── <slug>/<Component>.tsx        # 게임 하나당 디렉토리 하나 (보조 .ts 파일 가능)
├── i18n/
│   ├── en.ts · ko.ts                 # Astro 레이아웃·뷰용 문자열
│   ├── index.ts                      # Locale 타입, t(), localePath(), localize() 등
│   └── react.tsx                     # LangProvider, useLang(), useMessages()
├── layouts/
│   ├── GameLayout.astro · ToolLayout.astro · LandingLayout.astro
├── pages/                            # 얇은 라우트 래퍼 (lang만 정해서 views/에 넘김)
│   ├── index.astro · tools/ · games/
│   └── ko/                           # 같은 구조, lang="ko"
├── views/                            # 실제 페이지 본체 (en/ko 공용)
│   ├── HomeView.astro
│   ├── ToolIndexView.astro · ToolDetailView.astro
│   └── GameIndexView.astro · GameDetailView.astro
├── scripts/
│   └── catalogFilter.ts              # 목록 페이지 검색·카테고리 필터 (?cat=, ?q= 지원)
├── styles/
│   └── global.css                    # 디자인 토큰(CSS 변수), 폰트, 스크롤바
└── tools/
    ├── lib/
    │   ├── format.ts                 # formatBytes
    │   └── color.ts                  # hex/RGB/HSL 변환
    └── <slug>/<Component>.tsx        # 툴 하나당 디렉토리 하나 (보조 .ts 파일 가능)

public/
├── CNAME                             # ctrlcat.dev
├── robots.txt                        # sitemap-index.xml 안내
└── favicon.svg · favicon-tool.svg · favicon-game.svg
```

---

## 라우팅

페이지 파일을 직접 만들 필요 없습니다. 콘텐츠 컬렉션에 `.md`를 추가하면 `[slug].astro`가 자동으로 페이지를 생성합니다.

| URL | 라우트 파일 | 뷰 |
|---|---|---|
| `/` · `/ko/` | `pages/index.astro` · `pages/ko/index.astro` | `HomeView` |
| `/tools/` · `/ko/tools/` | `pages/(ko/)tools/index.astro` | `ToolIndexView` |
| `/tools/<slug>/` · `/ko/tools/<slug>/` | `pages/(ko/)tools/[slug].astro` | `ToolDetailView` |
| `/games/` · `/ko/games/` | `pages/(ko/)games/index.astro` | `GameIndexView` |
| `/games/<slug>/` · `/ko/games/<slug>/` | `pages/(ko/)games/[slug].astro` | `GameDetailView` |

라우트 파일은 `getStaticPaths`와 `lang` 지정만 합니다. 화면을 바꿀 때는 `views/`만 고치면 en/ko 양쪽에 반영됩니다.

리다이렉트: `/games/tetris` → `/games/block-drop` (`astro.config.mjs`의 `redirects`). 이름을 바꾼 게임의 옛 링크를 살려 두기 위한 것입니다.

사이트맵: `@astrojs/sitemap` 3.2.1 (Astro 4용으로 고정)이 빌드 때 `sitemap-index.xml`을 만듭니다. 리다이렉트 페이지는 포함되지 않습니다.

---

## 컴포넌트 렌더링 파이프라인

```
content/tools/<slug>.md
  component: "word-counter/WordCounter"
    └─ ToolDetailView.astro → <ToolRenderer component=... lang=... client:load />
         └─ import.meta.glob("/src/tools/**/*.tsx")
              └─ key: "word-counter/WordCounter"
                   └─ <LangProvider lang> → <Suspense> → lazy(<WordCounter />)
```

`component` 필드값이 glob key로 사용됩니다 (확장자 없음). glob은 `.tsx`만 잡으므로 같은 디렉토리에 둔 `.ts` 보조 파일(파서, 데이터 등)은 컴포넌트로 취급되지 않습니다.

게임은 `GameRenderer` → `LangProvider` → `GameShell`(효과음·전체 화면) → 게임 컴포넌트 순서입니다.

---

## 문서 폴백 흐름 (상세 페이지 본문)

`DocArticle.astro`가 처리합니다.

```
lang === "ko"
  1. getEntry("docs", "<kind>s/<slug>/ko") 시도
  2. 있으면 → KO 문서 렌더링
  3. 없으면 → 영어 content body 렌더링 (폴백)
lang === "en" → 영어 content body
```

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

---

## 포털 빌드 (`portal/`)

ctrlcat 게임을 해외 웹게임 포털용 단독 HTML5 묶음으로 뽑는 별도 빌드입니다. 사이트 빌드(`npm run build`)와는 무관합니다.

```
node portal/build.mjs --portal <none|demo|debug|playgama|yandex|gamedistribution> [slug ...]
→ portal-dist/<portal>/<slug>/ (index.html + assets) 와 <slug>.zip
```

- `portal/main.tsx`: 게임 하나를 `portal/PortalFrame.tsx`(화면 전체를 채우는 무대 + 오른쪽 위 음소거·전체 화면 버튼, 사이트의 `GameShell` 대신) 안에 렌더링합니다. `virtual-game`, `virtual-provider`, `virtual-theme` 별칭은 `portal/vite.config.mjs`가 게임 컴포넌트, `portal/providers/<portal>.ts`, `portal/themes/<slug>.css`(없으면 `default.css`)로 연결합니다.
- `portal/themes/<slug>.css`: 포털 빌드에서만 `--game-*` 변수와 무대 배경 `--portal-stage`를 덮어씁니다. 게임은 오른쪽 위 약 56px를 비워 둡니다.
- 언어: `portal/main.tsx`가 브라우저 첫 번째 언어를 보고 한국어 브라우저면 `ko`, 아니면 `en`으로 렌더링합니다. 사이트의 언어 이동 규칙과 같습니다 (`.claude/i18n.md`).
- `portal/providers/*.ts`: 포털 SDK 어댑터. `init`, `loadingFinished`, `host.onEvent`, `host.requestBreak`를 구현합니다.
- `portal/audio.ts`: 광고 중·탭 숨김 시 모든 AudioContext를 멈춥니다.
- 게임 쪽 연결은 `src/games/lib/gameEvents.ts`(`usePhaseEvents`, `afterBreak`)입니다. 사이트에서는 호스트가 없어서 아무 일도 하지 않습니다.
- `portal/tokens.css`는 빌드 때 `src/styles/global.css`에서 웹폰트 import만 빼고 생성됩니다(커밋하지 않음).
- GameDistribution 게임 ID는 `portal/gd-ids.json`에 `{ "<slug>": "<id>" }`로 적습니다.
