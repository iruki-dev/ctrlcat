# 게임 추가 절차

## 만들어야 할 파일 (2개)

### 1. `src/content/games/<slug>.md`

```yaml
---
title: "Game Name"
description: "One-line description for users."
category: strategy
icon: "<slug>"
tags: [tag1, tag2]
status: published
featured: true
publishedAt: 2026-05-13
component: "<slug>/<ComponentName>"
difficulty: 3          # 1=Easy 2=Easy-Med 3=Medium 4=Hard 5=Expert
playTime: 2            # 분 단위
localizations:
  ko:
    title: "한국어 제목"
    description: "한국어 설명"
---

## 제목

일반 사용자를 위한 영어 문서 본문. 코드 블록 없음.
```

### 2. `src/games/<slug>/<ComponentName>.tsx`

게임 유형에 따라 두 가지 접근 방식 중 하나를 선택합니다.

#### HTML/React 방식 — 턴제·카드·퍼즐처럼 상태 중심 게임에 적합

```tsx
import { useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { GameMessage } from "../../components/games/ui/GameMessage";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";

export default function MyGame() {
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto">
      <ScoreDisplay label="Score" value={0} />

      <div className="rounded-2xl border-2 border-game-border bg-game-surface p-6">
        {/* 게임 UI */}
      </div>

      {status !== "playing" && (
        <GameMessage type="success">You won!</GameMessage>
      )}

      <GameButton onClick={() => setStatus("playing")}>New Game</GameButton>
    </div>
  );
}
```

#### Canvas 방식 — Snake·Tetris·아케이드처럼 루프·애니메이션이 필요한 게임에 적합

```tsx
import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "../lib/GameCanvas";
import { useGameLoop } from "../lib/useGameLoop";
import { useKeys, useSwipe } from "../lib/useInput";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";

export default function MyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const { held, consume } = useKeys();

  // 방향키 스와이프 (모바일 지원)
  useSwipe((dir) => {
    // 방향 전환 로직
  });

  // 게임 상태 (ref로 관리 — 렌더링 불필요한 데이터)
  const stateRef = useRef({ /* 게임 데이터 */ });

  useGameLoop(
    canvasRef,
    {
      update(dt) {
        // dt: 경과 초 (최대 0.1)
        // held.current.has("ArrowLeft") — 키 홀드 체크
        // consume("ArrowUp") — 단발 키 입력 (Tetris 회전 등)
      },
      draw(ctx, width, height) {
        // ctx는 이미 DPR 스케일 적용됨
        // width, height는 논리적 크기 (CSS px 기준)
        ctx.fillStyle = "#f5f3ff";
        ctx.fillRect(0, 0, width, height);
        // 게임 오브젝트 그리기
      },
    },
    running
  );

  return (
    <div className="flex flex-col gap-4 items-center">
      <ScoreDisplay label="Score" value={score} />
      <GameCanvas
        ref={canvasRef}
        width={400}
        height={400}
        className="rounded-2xl border-2 border-game-border"
      />
      <GameButton onClick={() => setRunning((r) => !r)}>
        {running ? "Pause" : "Start"}
      </GameButton>
    </div>
  );
}
```

---

## 추가로 업데이트할 파일

### `src/components/Icon.astro`

파일 맨 아래에 소형 아이콘 블록을 추가합니다 (24×24 viewBox, stroke 기반):

```astro
{name === "<slug>" && (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.75"
       stroke-linecap="round" stroke-linejoin="round" class={className}>
    <!-- SVG 패스 -->
  </svg>
)}
```

### `src/components/GameIllustration.astro`

파일 맨 아래에 대형 일러스트 블록을 추가합니다 (200×160 viewBox, 컬러 filled):

```astro
{slug === "<slug>" && (
  <svg viewBox="0 0 200 160" width="200" height="160"
       xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- 게임 테마 컬러 SVG 일러스트 -->
    <!-- 색상 팔레트: violet-50~600, pink #f472b6 -->
  </svg>
)}
```

### `.claude/content.md`

현재 게임 목록 표에 새 행을 추가합니다.

---

## 한국어 문서 추가 (선택)

`src/content/docs/games/<slug>/ko.md`:

```yaml
---
kind: game
ref: <slug>
lang: ko
---

## 제목

한국어 문서 본문.
```

추가 후 `.claude/content.md`의 한국어 문서 목록도 업데이트합니다.

---

## 체크리스트

- [ ] `src/content/games/<slug>.md` 생성
- [ ] `src/games/<slug>/<ComponentName>.tsx` 생성
- [ ] `src/components/Icon.astro`에 소형 아이콘 블록 추가
- [ ] `src/components/GameIllustration.astro`에 일러스트 블록 추가
- [ ] `.claude/content.md` 게임 목록 업데이트
- [ ] (선택) 한국어 문서 생성 후 KO 문서 목록 업데이트
- [ ] `npm run build` 통과 확인
