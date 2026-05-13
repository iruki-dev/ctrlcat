# 콘텐츠 — 스키마 · 현재 목록

## 컬렉션 스키마

### tools (`src/content/tools/<slug>.md`)

```yaml
title: string           # 필수
description: string     # 필수
category: text | math | color | data | image | developer | productivity | converter
icon: string            # Icon.astro의 name과 일치하는 slug
tags: string[]
status: published | draft | wip
featured: boolean
publishedAt: date
component: string       # "<slug>/<ComponentName>" 형식
localizations:
  ko:
    title: string
    description: string
```

### games (`src/content/games/<slug>.md`)

tools와 동일하고 아래 필드가 추가됩니다:

```yaml
difficulty: 1~5         # 1=Easy 2=Easy-Med 3=Medium 4=Hard 5=Expert
playTime: number        # 분 단위
```

### docs (`src/content/docs/<kind>/<slug>/<lang>.md`)

```yaml
kind: tool | game
ref: string             # 부모 slug
lang: string            # ko 등
```

---

## 카테고리

**Tools:** `text` · `math` · `color` · `data` · `image` · `developer` · `productivity` · `converter`

**Games:** `puzzle` · `arcade` · `strategy` · `word` · `number` · `card` · `trivia`

---

## 현재 툴 (5개)

| slug | 제목 | 카테고리 | icon | component |
|---|---|---|---|---|
| `word-counter` | Word Counter | text | `word-counter` | `word-counter/WordCounter` |
| `base64-encoder` | Base64 Encoder | developer | `base64-encoder` | `base64-encoder/Base64Encoder` |
| `json-formatter` | JSON Formatter | developer | `json-formatter` | `json-formatter/JsonFormatter` |
| `password-generator` | Password Generator | productivity | `password-generator` | `password-generator/PasswordGenerator` |
| `color-converter` | Color Converter | color | `color-converter` | `color-converter/ColorConverter` |

---

## 현재 게임 (3개)

| slug | 제목 | 카테고리 | difficulty | playTime | icon |
|---|---|---|---|---|---|
| `number-guesser` | Number Guesser | number | 2 | 2 | `number-guesser` |
| `tic-tac-toe` | Tic-Tac-Toe vs AI | strategy | 3 | 1 | `tic-tac-toe` |
| `snake` | Snake | arcade | 2 | 5 | `snake` |

---

## 현재 한국어 문서 (8개)

| 경로 | 대상 |
|---|---|
| `docs/tools/word-counter/ko.md` | Word Counter |
| `docs/tools/base64-encoder/ko.md` | Base64 Encoder |
| `docs/tools/color-converter/ko.md` | Color Converter |
| `docs/tools/json-formatter/ko.md` | JSON Formatter |
| `docs/tools/password-generator/ko.md` | Password Generator |
| `docs/games/number-guesser/ko.md` | Number Guesser |
| `docs/games/tic-tac-toe/ko.md` | Tic-Tac-Toe vs AI |
| `docs/games/snake/ko.md` | Snake |

모든 툴·게임에 한국어 문서가 있습니다.
