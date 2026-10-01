---
title: "Regex Tester"
description: "Test a regular expression against sample text and see every match highlighted as you type, with capture groups listed separately."
category: developer
icon: "regex-tester"
tags: [regex, testing, pattern, validation]
status: published
featured: false
publishedAt: 2026-10-01
component: "regex-tester/RegexTester"
localizations:
  ko:
    title: "정규식 테스터"
    description: "정규 표현식을 샘플 텍스트에 바로 적용해 일치하는 부분을 강조해서 보여주고, 캡처 그룹을 따로 정리해 줍니다."
---

## What this is

A regular expression is a short pattern that describes which pieces of text you want to find. Writing one is easy. Being sure it matches exactly what you meant is harder.

This tool runs your pattern against sample text as you type. Every match is highlighted in place, so you can see what the pattern caught and what it skipped. Each match is also listed on its own, together with any capture groups inside it.

## Where this is useful

- Checking an email, phone, or postal code pattern before you put it into a signup form.
- Finding out why a pattern matches more text than you expected, which usually means a quantifier is too greedy.
- Pulling a date, an ID, or a price out of log lines and confirming the capture groups land on the right pieces.
- Learning what the flags do by switching them on and off against the same text.
- Testing awkward cases, like empty input or text that spans several lines.

## How to use this tool

Type your pattern into the pattern field. Leave out the surrounding slashes; just the pattern itself is enough.

Turn on the flags you need. Global finds every match instead of only the first. Ignore case matches letters regardless of capitalization. Multiline changes what the start and end anchors mean, and dotall lets the dot match line breaks too.

Paste or type your sample text below. Matches appear highlighted right away, and the list underneath shows each match with its position and its capture groups. Named groups appear under their names.

If the pattern is not valid yet, a short message explains what went wrong. That is normal while you are still typing. Use the copy button to take all matches with you as a plain list.

## Frequently asked questions

**Does my text get sent anywhere?**
No. The pattern and the text stay in your browser, and the matching runs there as well. Nothing is uploaded or stored, so you can safely try the tool on sample data from your own work.

**Which flavor of regular expressions does this use?**
It uses the one built into your browser, which is the JavaScript flavor. Most everyday patterns behave the same way in other languages, but some features differ by browser version.

**Why does my pattern find nothing when it clearly should?**
The two usual causes are a missing global flag, which stops the search after the first match, and characters that need escaping. A dot, a question mark, or a bracket stands for something special in a pattern, so write a backslash in front of one when you mean the character itself.
