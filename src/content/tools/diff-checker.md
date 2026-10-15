---
title: "Diff Checker"
description: "Compare two blocks of text and see exactly which lines were added, removed, or left alone. Works entirely in your browser."
category: text
icon: "diff-checker"
tags: [diff, compare, text, review]
status: published
featured: false
publishedAt: 2026-10-15
component: "diff-checker/DiffChecker"
localizations:
  ko:
    title: "Diff 비교"
    description: "두 개의 텍스트를 나란히 비교해 추가, 삭제, 변경되지 않은 줄을 한눈에 확인합니다. 모든 처리는 브라우저 안에서 이루어집니다."
---

## What this is

A diff checker takes two versions of the same text and lines them up. Instead of reading both copies and hoping you notice the difference, you get a single list where every line is marked as added, removed, or unchanged.

This is the same idea behind the comparison view in version control systems, applied to any text you paste in. Everything runs locally in your browser, so the text never leaves your machine.

## Where this is useful

- Checking what changed between two versions of a configuration file before you deploy one of them.
- Reviewing an edited draft against the original to see which paragraphs a reviewer actually touched.
- Comparing two lists of names, SKUs, or email addresses to find entries that only appear in one of them.
- Confirming that a copied block of text arrived intact after moving it between applications.
- Spotting a single changed character in a long key, path, or translated string.

## How to use this tool

Paste the earlier version into the Original box and the newer version into the Changed box. The comparison appears as soon as both boxes have content.

Each row is labelled on the left. A minus sign means the line exists only in the original, a plus sign means it exists only in the changed version, and a blank marker means both copies match. The counters above the result tell you how many lines fall into each group.

Two switches adjust what counts as a difference. Ignore whitespace treats runs of spaces and tabs as equivalent, which helps when indentation changed but the content did not. Ignore case makes the comparison insensitive to capitalisation.

Turn on Only changed lines to hide matching rows. Use the copy button to take the result away as a plain unified diff.

## Frequently asked questions

**Does my text get uploaded anywhere?**
No. The comparison is calculated in your browser with JavaScript, and nothing is sent to a server. You can disconnect from the network and the tool still works.

**Why is a line shown as both removed and added when I only edited a few words?**
The comparison works line by line, so any change inside a line marks the whole line as replaced. You will see the old version as a removal followed by the new version as an addition, which lets you read both side by side.

**How large an input can it handle?**
A few thousand lines per side is comfortable. Very large inputs are compared with a simpler method to keep the page responsive, which can group changes into bigger blocks instead of pinpointing single lines.
