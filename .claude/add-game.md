# 게임 추가 절차

## 만들어야 할 파일

### 1. `src/content/games/<slug>.md`

```yaml
---
title: "Game Name"
description: "One-line description for users."
category: strategy
icon: "<slug>"
tags: [tag1, tag2]
status: published
featured: false
publishedAt: 2026-05-13
component: "<slug>/<ComponentName>"
difficulty: 3          # 1=Easy 2=Easy-Med 3=Medium 4=Hard 5=Expert
playTime: 2            # 분 단위
localizations:
  ko:
    title: "한국어 제목"
    description: "한국어 설명"
---

## How it works

일반 사용자를 위한 영어 문서 본문. 코드 블록 없음.
```

실존 게임의 상표 이름(예: 상용 블록 퍼즐 이름)은 제목·slug에 쓰지 않습니다. 장르를 설명하는 이름을 씁니다.

### 2. `src/games/<slug>/<ComponentName>.tsx`

문자열은 `messages`에 두고, 공통 라벨(시작, 다시 하기, 점수, 최고 기록 등)은 `common`에서 펼쳐 씁니다.

#### React 방식 — 턴제·카드·퍼즐처럼 상태 중심 게임

```tsx
import { useCallback, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { GameMessage } from "../../components/games/ui/GameMessage";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { useBestScore } from "../lib/useBestScore";

type Phase = "idle" | "playing" | "won" | "lost";

const messages = {
  en: { ...common.en, intro: "How to play, in one or two sentences.", won: "You won!", lost: "Game over." },
  ko: { ...common.ko, intro: "게임 방법을 한두 문장으로.", won: "승리!", lost: "게임 오버." },
};

export default function MyGame() {
  const m = useMessages(messages);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const { best, record } = useBestScore("ctrlcat-<slug>-best");

  const start = useCallback(() => { setScore(0); setPhase("playing"); }, []);
  const finish = (won: boolean) => { record(score); setPhase(won ? "won" : "lost"); };

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">{m.intro}</p>
        <GameButton onClick={start} size="xl">{m.start}</GameButton>
      </div>
    );
  }

  if (phase !== "playing") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label={m.score} value={score} size="lg" highlight />
        <GameMessage type={phase === "won" ? "success" : "error"}>{phase === "won" ? m.won : m.lost}</GameMessage>
        <GameButton onClick={start} size="xl">{m.playAgain}</GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        <ScoreDisplay label={m.score} value={score} highlight />
        <ScoreDisplay label={m.best} value={best ?? "-"} />
      </div>
      {/* 게임 UI */}
      <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>{m.quit}</GameButton>
    </div>
  );
}
```

#### Canvas 방식 — 루프·애니메이션이 필요한 아케이드 게임

```tsx
import { useRef, useState } from "react";
import { GameCanvas } from "../lib/GameCanvas";
import { useGameLoop } from "../lib/useGameLoop";
import { useKeys, useSwipe } from "../lib/useInput";

/* Canvas는 Tailwind 클래스를 못 읽으므로 색은 상수로 둡니다. */
const BG = "#f5f3ff";

export default function MyArcade() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const { held, consume } = useKeys();
  const stateRef = useRef({ /* 렌더링이 필요 없는 게임 데이터 */ });

  useSwipe((dir) => { /* 터치 입력 */ });

  useGameLoop(canvasRef, {
    update(dt) {
      // dt: 경과 초 (최대 0.1)
      // held.current.has("ArrowLeft"): 누르고 있는 키
      // consume("ArrowUp"): 한 번 누른 키 (회전 등)
    },
    draw(ctx, width, height) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);
      // 캔버스에 글자를 그릴 때도 m.xxx를 씁니다
    },
  }, running);

  return <GameCanvas ref={canvasRef} width={400} height={400} className="rounded-2xl border-2 border-game-border" />;
}
```

UI 컴포넌트 (`src/components/games/ui/`): `GameButton`(`size` sm–xl) · `GameInput` · `ScoreDisplay` · `GameMessage`(`info` · `success` · `warning` · `error` · `hint`). 효과음은 `useSound()`(`src/components/games/SoundContext.tsx`), 음소거·전체 화면 버튼은 `GameShell`이 자동으로 붙입니다.

---

## 추가로 업데이트할 파일

### `src/components/Icon.astro` — 24×24 stroke 아이콘

```astro
{name === "<slug>" && (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.75"
       stroke-linecap="round" stroke-linejoin="round" class={className}>
    <!-- SVG 패스 -->
  </svg>
)}
```

### `src/components/GameIllustration.astro` — 200×160 컬러 일러스트

```astro
{slug === "<slug>" && (
  <svg viewBox="0 0 200 160" width="200" height="160"
       xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- violet-50~600, pink 계열 -->
  </svg>
)}
```

빠뜨리면 목록 카드의 일러스트 영역이 비어 보입니다.

### `src/content/docs/games/<slug>/ko.md`

```yaml
---
kind: game
ref: <slug>
lang: ko
---

## 게임 방식

한국어 문서 본문.
```

### `.claude/content.md`

게임 목록 표와 한국어 문서 목록에 새 행을 추가합니다.

---

## 체크리스트

- [ ] `src/content/games/<slug>.md` (영어 본문 + `localizations.ko`)
- [ ] `src/games/<slug>/<ComponentName>.tsx` (en/ko `messages`, 하드코딩 문자열 없음)
- [ ] `src/components/Icon.astro` 아이콘 블록
- [ ] `src/components/GameIllustration.astro` 일러스트 블록
- [ ] `src/content/docs/games/<slug>/ko.md`
- [ ] `.claude/content.md` 업데이트
- [ ] `npm run build` 통과, `/games/<slug>/`와 `/ko/games/<slug>/` 둘 다 플레이해 보기
