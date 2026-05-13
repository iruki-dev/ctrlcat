# CLAUDE.md — ctrlcat

> **메타 규칙:** 코드를 수정하면 관련 문서도 함께 업데이트합니다. 이 파일과 `.claude/` 하위 문서들이 코드를 직접 읽지 않고도 구조를 파악할 수 있는 근거입니다.

---

## 프로젝트

**ctrlcat.dev** — Astro 4.x 정적 사이트. Tools(`/tools/`) + Games(`/games/`) 두 섹션. GitHub Pages 배포.

Tools: cyan 테마 (`#0891b2`) · Games: violet 테마 (`#7c3aed`)

---

## 핵심 제약

- Tools ↔ Games 간 링크나 공유 컴포넌트는 없습니다
- 이모지는 어디에도 쓰지 않습니다 (UI, 문서, 아이콘 모두)
- 사용자에게 보이는 문자열은 `t(lang).key`로 처리합니다 — 하드코딩 없음
- 색상은 Tailwind 토큰을 씁니다 — hex 직접 지정 없음
- 전역 CSS는 추가하지 않습니다 (Tailwind 클래스만)
- DB나 서버사이드 로직은 없습니다
- 문서는 일반 사용자 대상 — 코드 블록·수식·알고리즘 설명 없음

---

## 건드리지 않는 파일

새 툴/게임을 추가할 때 이 파일들은 수정할 필요 없습니다:

`src/layouts/` · `src/pages/` · `src/content/config.ts` · `tailwind.config.mjs` · `astro.config.mjs`

---

## 빌드

```bash
npm run dev      # localhost:4321
npm run build    # dist/ 생성
npm run preview  # dist/ 서빙
```

커밋 전에 빌드를 돌려봅니다. TypeScript 에러가 있으면 빌드가 막힙니다.

---

## 상세 문서

| 필요한 정보 | 파일 |
|---|---|
| 파일 구조, 라우팅, 렌더링 파이프라인 | `.claude/architecture.md` |
| 디자인 토큰, 아이콘 시스템, UI 규칙 | `.claude/design.md` |
| 컬렉션 스키마, 현재 콘텐츠 목록 | `.claude/content.md` |
| i18n 시스템 | `.claude/i18n.md` |
| 툴 추가 절차 | `.claude/add-tool.md` |
| 게임 추가 절차 | `.claude/add-game.md` |
| 콘텐츠 문서 작성 규칙 | `.claude/docs-guide.md` |
