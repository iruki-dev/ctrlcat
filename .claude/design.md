# 디자인 시스템 — 토큰 · 아이콘 · UI 규칙

## 디자인 원칙

- **Tools**: **Carbon Design System** (IBM) — 구조적이고 생산적인 UI. IBM Plex Sans, 직각 코너, 좌측 액센트 바, 플랫 타일.
- **Games**: **Material Design 3** (Google) — 표현적이고 역동적인 UI. Roboto, 둥근 모서리, 고도(elevation) 카드, 필 칩.

## 폰트

| 영역 | 폰트 | Tailwind 클래스 |
|---|---|---|
| Tools | IBM Plex Sans | `font-tool` |
| Games | Roboto | `font-game` |
| 공용 | Inter | `font-sans` |
| 모노 | IBM Plex Mono | `font-mono` |

## Tailwind 색상 토큰

값은 `src/styles/global.css`의 CSS 변수(라이트/다크 각각)에 있고, `tailwind.config.mjs`가 `rgb(var(--x) / <alpha-value>)` 형태로 연결합니다. 컴포넌트에서 hex를 직접 쓰는 대신 이 토큰을 씁니다. 다크 모드는 변수 값만 바뀌므로 `dark:` 접두사 없이 자동으로 따라갑니다.

예외: `<canvas>` 드로잉과 다운로드용 SVG/PNG(QR 코드 등)는 Tailwind 클래스를 읽을 수 없어서 파일 상단 상수로 색을 둡니다. 이때도 DOM 클래스에는 `bg-[#...]` 같은 임의 hex를 쓰지 않습니다.

### Tools 토큰 — Carbon Design System

| 토큰 | 값 (라이트) | 용도 |
|---|---|---|
| `tool-bg` | `#f4f4f4` (Gray-10) | 페이지 배경 |
| `tool-surface` | `#ffffff` | 카드, 패널 |
| `tool-surface-2` | `#e0e0e0` (Gray-20) | 호버 bg, 입력 prefix |
| `tool-border` | `#c6c6c6` (Gray-30) | 기본 테두리 |
| `tool-border-dim` | `#e0e0e0` (Gray-20) | 섬세한 구분선 |
| `tool-accent` | `#0f62fe` (Blue-60) | 주요 액션, 활성 상태 |
| `tool-accent-light` | `#edf5ff` (Blue-10) | 활성 항목 배경 틴트 |
| `tool-accent-dim` | `#0043ce` (Blue-70) | 호버 |
| `tool-muted` | `#8d8d8d` (Gray-50) | 플레이스홀더, 메타 |
| `tool-text` | `#161616` (Gray-100) | 주 텍스트 |
| `tool-text-dim` | `#525252` (Gray-70) | 보조 텍스트 |
| `tool-on-accent` | `#ffffff` (다크: `#161616`) | `bg-tool-accent` 위의 글자 |

### Games 토큰 — Material Design 3

| 토큰 | 값 (라이트) | 용도 |
|---|---|---|
| `game-bg` | `#fffbfe` (MD3 background) | 페이지 배경 |
| `game-surface` | `#ffffff` | 카드, 패널 |
| `game-surface-2` | `#e7e0ec` (MD3 surface-variant) | 사이드바, 칩 bg |
| `game-border` | `#79747e` (MD3 outline) | 기본 테두리 |
| `game-border-dim` | `#e7e0ec` | 섬세한 구분선 |
| `game-accent` | `#7c3aed` (violet-600) | 주요 액션 |
| `game-accent-light` | `#eaddff` (MD3 primary-container) | 활성 칩/항목 bg |
| `game-accent-dim` | `#6d28d9` (violet-700) | 호버 |
| `game-secondary` | `#db2777` (pink-600) | 보조 액션 |
| `game-muted` | `#79747e` (MD3 outline) | 플레이스홀더, 메타 |
| `game-text` | `#1c1b1f` (MD3 on-surface) | 주 텍스트 |
| `game-text-dim` | `#49454e` (MD3 on-surface-variant) | 보조 텍스트 |
| `game-on-accent` | `#ffffff` (다크: `#381e72`) | `bg-game-accent` 위의 글자 |

### Site 토큰 — 랜딩 페이지

홈(`HomeView`)과 공용 헤더가 씁니다. `site-bg` · `site-surface` · `site-card` · `site-border` · `site-border-strong` · `site-text` · `site-text-dim` · `site-muted` · `site-tool` · `site-tool-hover`. 게임 쪽 강조는 `game-accent`를 그대로 씁니다. 값은 `global.css` 참고.

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

**등록된 아이콘:** 툴·게임 slug마다 하나씩 있습니다. 목록은 `Icon.astro`의 `name === "..."` 블록이 기준입니다.

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

**등록된 일러스트:** 게임 slug마다 하나씩 있습니다. 목록은 `GameIllustration.astro`의 `slug === "..."` 블록이 기준입니다. 일러스트 안의 색은 SVG fill 값으로 직접 둡니다.

**사용 위치:** 게임 리스팅 카드(`views/GameIndexView.astro`), 홈페이지 게임 섹션(`views/HomeView.astro`).

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
| `views/HomeView.astro` 홈 헤더 | 22×22 | 흰 캐럿 |
| `layouts/ToolLayout.astro` 사이드바 헤더 | 18×18 | 시안 캐럿+바 |
| `layouts/GameLayout.astro` 사이드바 헤더 | 18×18 | 바이올렛 캐럿+원 |

---

## UI 컴포넌트 규칙

### Tools — Carbon Design System

- 임포트 경로: `../../components/tools/ui/`
- 클래스: `bg-tool-*`, `text-tool-*`, `border-tool-*`
- 테두리: `border border-tool-border` (1px, 직각)
- 라운드: **없음** (Carbon 원칙: 직각 코너)
- 버튼: 직각, 플랫, `bg-tool-accent text-tool-on-accent`, 항상 `type="button"`
- 오류·성공 알림: `ToolNotice` (`tone="error" | "success"`, 스크린리더에 알림)
- 복사: `CopyButton` (실패 시 실패 상태 표시)
- 입력: 전체 테두리 + 포커스 2px ring
- 활성 네비: `border-l-[3px] border-l-tool-accent bg-tool-accent-light`

### Games — Material Design 3

- 임포트 경로: `../../components/games/ui/`
- 클래스: `bg-game-*`, `text-game-*`, `border-game-*`
- 라운드: `rounded-3xl` (카드), `rounded-full` (버튼/칩), `rounded-[28px]` (네비 항목)
- 버튼: `rounded-full`, 채워진 스타일, shadow-md-1, `bg-game-accent text-game-on-accent`
- 상태 메시지: `GameMessage` (`info` · `success` · `warning` · `error` · `hint`)
- 점수판: `ScoreDisplay` (값이 없으면 `"-"`를 표시)
- 카드: `shadow-md-1 hover:shadow-md-3` (MD3 고도)
- 활성 네비: `rounded-[28px] bg-game-accent-light text-game-accent`
- 필터: MD3 Filter Chips (`rounded-full`, selected: `border-2 border-game-accent bg-game-accent-light`)

### 자기 화면을 직접 그리는 게임

2048, Block Drop, Klondike Solitaire, Snake는 사이트 테마(violet MD3)를 쓰지 않고, 그 장르의 실제 게임처럼 보이도록 게임 파일 상단 상수로 자기 색을 둡니다 (canvas 상수와 같은 예외). 사이트와 포털 빌드에서 똑같이 보입니다.

| 게임 | 기준으로 삼은 모습 | 점수 표시 |
|---|---|---|
| 2048 | 밝은 바탕, 돌 회색 판, 각진 평면 타일 | 판 위 한 줄 텍스트 (점수, 최고) |
| Block Drop | 검은 우물과 회색 테두리, 빗면 블록 | 검은 상자 안 6자리 숫자 (점수, 최고, 레벨, 줄, 다음) |
| Klondike Solitaire | 데스크톱 솔리테어의 녹색 테이블, 메뉴 막대 | 아래 상태 표시줄 (점수, 이동, 시간) |
| Snake | 옛 휴대폰 LCD (올리브 바탕, 단색 점) | 왼쪽 위 4자리 숫자 |

이 네 게임에는 제목 화면 장식(로고 타일, 눈썹 문구, 알약 버튼), 칭찬 팝업, 빛번짐을 넣지 않습니다. 2048과 Klondike는 열자마자 판이 나옵니다.

---

## 카드 디자인 패턴

### 게임 카드 (리스팅·홈페이지) — MD3 Elevated Card

```
rounded-3xl overflow-hidden bg-game-surface shadow-md-1
hover:shadow-md-3 transition-shadow duration-200
```

구조:
1. **미디어** `h-44 flex items-center justify-center bg-game-accent-light/30` → `<GameIllustration slug={...}/>`
2. **콘텐츠** `px-5 py-4` → h2 제목 + 난이도 칩 + 시간 + "Play →"

### 툴 카드 (리스팅 페이지) — Carbon Tile

```
bg-tool-surface p-5 hover:bg-tool-accent-light transition-colors
(그리드 gap-px bg-tool-border border border-tool-border 안에 배치)
```

구조: `<Icon>` + featured 배지 → 제목 + 설명 → 태그 + "Use Tool →"

---

## 문서 스타일

- 대상: **일반 사용자** (개발자 아님)
- 코드 블록, 수식, 알고리즘 설명은 없습니다
- 일상 비유와 이야기로 설명합니다
- 한국어: 구어체 존댓말
- 이모지는 쓰지 않습니다
