# 툴 추가 절차

## 만들어야 할 파일

### 1. `src/content/tools/<slug>.md`

```yaml
---
title: "Tool Name"
description: "One-line description for users."
category: developer
icon: "<slug>"
tags: [tag1, tag2]
status: published
featured: false
publishedAt: 2026-05-13
component: "<slug>/<ComponentName>"
localizations:
  ko:
    title: "한국어 제목"
    description: "한국어 설명"
---

## What this is

일반 사용자를 위한 영어 문서 본문. 코드 블록 없음 (`.claude/docs-guide.md`).
```

### 2. `src/tools/<slug>/<ComponentName>.tsx`

사용자에게 보이는 문자열은 모두 `messages`에 두고 `useMessages`로 읽습니다 (`.claude/i18n.md`).

```tsx
import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

type ErrorCode = "empty";

const messages = {
  en: {
    input: "Input",
    output: "Output",
    convert: "Convert",
    clear: "Clear",
    errors: { empty: "Enter some text first." } as Record<ErrorCode, string>,
  },
  ko: {
    input: "입력",
    output: "결과",
    convert: "변환",
    clear: "지우기",
    errors: { empty: "먼저 텍스트를 입력하세요." } as Record<ErrorCode, string>,
  },
};

export default function MyTool() {
  const m = useMessages(messages);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);

  const run = () => {
    if (input.trim() === "") return setError("empty");
    setError(null);
    setOutput(input);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea label={m.input} value={input} onChange={(e) => setInput(e.target.value)} rows={6} />
      <div className="flex gap-2">
        <ToolButton onClick={run}>{m.convert}</ToolButton>
        <ToolButton variant="ghost" onClick={() => { setInput(""); setOutput(""); }}>{m.clear}</ToolButton>
      </div>
      {error && <ToolNotice>{m.errors[error]}</ToolNotice>}
      {output && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.output}</span>
          <CopyButton text={output} />
        </div>
      )}
    </div>
  );
}
```

UI 컴포넌트 (`src/components/tools/ui/`):

| 컴포넌트 | 용도 |
|---|---|
| `ToolButton` | 모든 버튼 (`variant`: primary · secondary · ghost · danger, `size`: sm · md · lg) |
| `ToolTextarea` | 여러 줄 입력 (`label`, `hint`) |
| `ToolInput` | 한 줄 입력 (`prefix`, `suffix`) |
| `StatCard` | 계산 결과 숫자 표시 |
| `CopyButton` | 클립보드 복사 (라벨은 자동 번역) |
| `ToolNotice` | 오류·성공 알림 (`tone`) |

공용 로직은 `src/tools/lib/`(바이트 표기, 색 변환)를 먼저 확인합니다. 툴 전용 파서·데이터가 길어지면 같은 디렉토리에 `.ts` 파일로 분리합니다.

---

## 추가로 업데이트할 파일

### `src/components/Icon.astro`

```astro
{name === "<slug>" && (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.75"
       stroke-linecap="round" stroke-linejoin="round" class={className}>
    <!-- SVG 패스 -->
  </svg>
)}
```

### `src/content/docs/tools/<slug>/ko.md`

```yaml
---
kind: tool
ref: <slug>
lang: ko
---

## 이 도구는 무엇인가요

한국어 문서 본문.
```

본문 첫 줄에 도구 이름만 있는 제목을 넣지 않습니다. 페이지 헤더가 이미 보여 줍니다.

### `.claude/content.md`

툴 목록 표와 한국어 문서 목록에 새 행을 추가합니다.

---

## 체크리스트

- [ ] `src/content/tools/<slug>.md` (영어 본문 + `localizations.ko`)
- [ ] `src/tools/<slug>/<ComponentName>.tsx` (en/ko `messages`, 하드코딩 문자열 없음, hex 없음)
- [ ] `src/components/Icon.astro` 아이콘 블록
- [ ] `src/content/docs/tools/<slug>/ko.md`
- [ ] `.claude/content.md` 업데이트
- [ ] `npm run build` 통과, `/tools/<slug>/`와 `/ko/tools/<slug>/` 둘 다 확인
