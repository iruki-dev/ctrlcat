# 디자인 시스템 — 토큰 · 아이콘 · UI 규칙

## Tailwind 색상 토큰

`tailwind.config.mjs`에 정의되어 있습니다. 컴포넌트에서 hex를 직접 쓰는 대신 이 토큰을 씁니다.

### Tools 토큰

| 토큰 | 값 | 용도 |
|---|---|---|
| `tool-bg` | `#f8fafc` | 페이지 배경 |
| `tool-surface` | `#ffffff` | 카드, 패널 |
| `tool-surface-2` | `#f1f5f9` | 사이드바, 호버 bg |
| `tool-border` | `#e2e8f0` | 기본 테두리 |
| `tool-border-dim` | `#f1f5f9` | 섬세한 구분선 |
| `tool-accent` | `#0891b2` | 주요 액션, 하이라이트 |
| `tool-accent-light` | `#e0f7fa` | 액션 틴트 bg |
| `tool-accent-dim` | `#0e7490` | 호버 |
| `tool-muted` | `#94a3b8` | 플레이스홀더, 메타 |
| `tool-text` | `#0f172a` | 주 텍스트 |
| `tool-text-dim` | `#475569` | 보조 텍스트 |

### Games 토큰

| 토큰 | 값 | 용도 |
|---|---|---|
| `game-bg` | `#f8fafc` | 페이지 배경 |
| `game-surface` | `#ffffff` | 카드, 패널 |
| `game-surface-2` | `#f5f3ff` | 사이드바, 호버 bg |
| `game-border` | `#e2e8f0` | 기본 테두리 |
| `game-border-dim` | `#f1f5f9` | 섬세한 구분선 |
| `game-accent` | `#7c3aed` | 주요 액션 |
| `game-accent-light` | `#ede9fe` | 액션 틴트 bg |
| `game-accent-dim` | `#6d28d9` | 호버 |
| `game-secondary` | `#db2777` | 보조 액션 (O 말 색 등) |
| `game-muted` | `#94a3b8` | 플레이스홀더, 메타 |
| `game-text` | `#0f172a` | 주 텍스트 |
| `game-text-dim` | `#475569` | 보조 텍스트 |

### 공용 토큰

| 토큰 | 값 |
|---|---|
| `brand-tool` | `#0891b2` |
| `brand-game` | `#7c3aed` |
| `text-2xs` | `0.625rem / 1rem` |
| `shadow-card` | 0 1px 3px rgba(0,0,0,0.06) |
| `shadow-card-hover` | 0 4px 12px rgba(0,0,0,0.08) |
| `animate-fade-in` | opacity 0→1, 0.2s ease-out |
| `animate-slide-up` | slide + fade, 0.25s ease-out |

---

## 아이콘 시스템

### Icon.astro — 소형 UI 아이콘

`src/components/Icon.astro`

```astro
<Icon name="word-counter" size={24} class="text-tool-accent" />
```

- viewBox 24×24, stroke 기반, stroke-width 1.75, 라운드 캡/조인
- `size` 기본값: 20px
- 색상은 `currentColor` — 부모의 `text-*` 클래스로 제어합니다

**등록된 아이콘:**

| `icon` 값 | 형태 |
|---|---|
| `word-counter` | 폴딩 코너 문서 + 텍스트 선 |
| `base64-encoder` | 양방향 순환 화살표 |
| `json-formatter` | 중괄호 쌍 `{ }` |
| `password-generator` | 자물쇠 |
| `color-converter` | 페인트 팔레트 (점 4개) |
| `number-guesser` | 3중 원 크로스헤어 |
| `tic-tac-toe` | 격자 + X와 O |

**사용 위치:** ToolLayout 헤더, GameLayout 헤더, 툴/게임 사이드바, 툴 리스팅 카드.

**새 툴/게임을 추가할 때:** `Icon.astro`에 `{name === "<slug>" && (<svg .../>)}` 블록을 추가하고 위 표를 업데이트합니다.

---

### GameIllustration.astro — 게임 카드 대형 일러스트

`src/components/GameIllustration.astro`

```astro
<GameIllustration slug="tic-tac-toe" />
```

- viewBox 200×160, 컬러 filled SVG
- 게임 테마 색상: violet-50~600, pink (#f472b6)

**등록된 일러스트:**

| `slug` | 디자인 |
|---|---|
| `number-guesser` | 불스아이 타겟 4단계 동심원 + 크로스헤어 + 화살표. 바이올렛 그라데이션 |
| `tic-tac-toe` | 게임 보드 (X 대각선 승리 상태). board: `#faf5ff`, X: `#c084fc`, O: `#f472b6` |

**사용 위치:** 게임 리스팅 카드(`games/index.astro`, `ko/games/index.astro`), 홈페이지 게임 섹션(`index.astro`, `ko/index.astro`).

**새 게임을 추가할 때:** `GameIllustration.astro`에 블록을 추가합니다. 빠뜨리면 카드 일러스트 영역이 비어 보입니다.

---

## 파비콘 시스템

`public/` — 32×32 viewBox, `rx="8"` 다크 `#09090b` 배경, stroke-width 2.5.

| 파일 | 캐럿 색상 | 보조 요소 | 담당 레이아웃 |
|---|---|---|---|
| `favicon.svg` | `#f8fafc` (흰) | 없음 | LandingLayout |
| `favicon-tool.svg` | `#00d4aa` (시안) | 하단 언더바 | ToolLayout |
| `favicon-game.svg` | `#c084fc` (바이올렛) | 하단 원 | GameLayout |

---

## 네비게이션 로고마크

인라인 SVG로 삽입됩니다. 각 섹션 파비콘과 동일한 도형을 씁니다.

| 위치 | 크기 | 색상 |
|---|---|---|
| `pages/index.astro` 홈 헤더 | 22×22 | 흰 캐럿 |
| `pages/ko/index.astro` 홈 헤더 | 22×22 | 흰 캐럿 |
| `layouts/ToolLayout.astro` 사이드바 헤더 | 18×18 | 시안 캐럿+바 |
| `layouts/GameLayout.astro` 사이드바 헤더 | 18×18 | 바이올렛 캐럿+원 |

---

## UI 컴포넌트 규칙

### Tools

- 임포트 경로: `../../components/tools/ui/`
- 클래스: `bg-tool-*`, `text-tool-*`, `border-tool-*`
- 테두리: `border border-tool-border` (1px)
- 라운드: `rounded-xl`
- 마운트 애니메이션: `animate-fade-in`

### Games

- 임포트 경로: `../../components/games/ui/`
- 클래스: `bg-game-*`, `text-game-*`, `border-game-*`
- 테두리: `border-2 border-game-border` (2px)
- 라운드: `rounded-xl` / `rounded-2xl`

---

## 카드 디자인 패턴

### 게임 카드 (리스팅·홈페이지)

```
rounded-2xl overflow-hidden border-2 border-game-border bg-game-surface
hover:border-game-accent hover:shadow-xl transition-all duration-200
```

구조:
1. **일러스트** `h-44 flex items-center justify-center bg-white` → `<GameIllustration slug={...}/>`
2. **텍스트** `px-4 py-3 border-t border-game-border` → 제목 + 난이도/시간 + "Play →"

### 툴 카드 (리스팅 페이지)

```
rounded-xl border border-tool-border border-t-2 border-t-tool-accent bg-tool-surface
hover:shadow-md transition-all duration-150
```

구조: `<Icon>` + featured 배지 → 제목 + 설명 → "Use Tool →"

---

## 문서 스타일

- 대상: **일반 사용자** (개발자 아님)
- 코드 블록, 수식, 알고리즘 설명은 없습니다
- 일상 비유와 이야기로 설명합니다
- 한국어: 구어체 존댓말
- 이모지는 쓰지 않습니다
