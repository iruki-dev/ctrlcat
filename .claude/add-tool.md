# 툴 추가 절차

## 만들어야 할 파일 (2개)

### 1. `src/content/tools/<slug>.md`

```yaml
---
title: "Tool Name"
description: "One-line description for users."
category: developer
icon: "<slug>"
tags: [tag1, tag2]
status: published
featured: true
publishedAt: 2026-05-13
component: "<slug>/<ComponentName>"
localizations:
  ko:
    title: "한국어 제목"
    description: "한국어 설명"
---

## 제목

일반 사용자를 위한 영어 문서 본문. 코드 블록 없음.
```

### 2. `src/tools/<slug>/<ComponentName>.tsx`

```tsx
import { useState } from "react";
import { Button } from "../../components/tools/ui/Button";
import { Textarea } from "../../components/tools/ui/Textarea";
// StatCard, Input, CopyButton 필요 시 추가

export default function MyTool() {
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="..."
        className="min-h-32"
      />
      <Button onClick={() => {}}>
        실행
      </Button>
    </div>
  );
}
```

---

## 추가로 업데이트할 파일

### `src/components/Icon.astro`

파일 맨 아래에 블록을 추가합니다:

```astro
{name === "<slug>" && (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.75"
       stroke-linecap="round" stroke-linejoin="round" class={className}>
    <!-- SVG 패스 -->
  </svg>
)}
```

### `.claude/content.md`

현재 툴 목록 표에 새 행을 추가합니다.

---

## 한국어 문서 추가 (선택)

`src/content/docs/tools/<slug>/ko.md`:

```yaml
---
kind: tool
ref: <slug>
lang: ko
---

## 제목

한국어 문서 본문.
```

추가 후 `.claude/content.md`의 한국어 문서 목록도 업데이트합니다.

---

## 체크리스트

- [ ] `src/content/tools/<slug>.md` 생성
- [ ] `src/tools/<slug>/<ComponentName>.tsx` 생성
- [ ] `src/components/Icon.astro`에 아이콘 블록 추가
- [ ] `.claude/content.md` 툴 목록 업데이트
- [ ] (선택) 한국어 문서 생성 후 KO 문서 목록 업데이트
- [ ] `npm run build` 통과 확인
