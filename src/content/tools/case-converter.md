---
title: "Case Converter"
description: "Convert text between upper, lower, title, sentence, camel, Pascal, snake, kebab and constant case with a live preview of every result."
category: text
icon: "case-converter"
tags: [case, camelcase, snake-case, kebab-case, text, rename]
status: published
featured: false
publishedAt: 2026-11-12
component: "case-converter/CaseConverter"
localizations:
  ko:
    title: "대소문자 변환기"
    description: "텍스트를 대문자, 소문자, 제목, 문장, 카멜, 파스칼, 스네이크, 케밥, 상수 표기로 바꾸고 모든 결과를 한눈에 비교합니다."
---

## What this is

Text often arrives in the wrong shape. A heading comes in shouting, a variable name uses underscores when the project uses hyphens, a pasted sentence has random capitals through it.

This tool takes whatever you paste and shows the same text in nine common cases at once. You pick the one you want and copy it. Nothing leaves your browser, so you can paste private notes or internal code without worry.

## Where this is useful

You are renaming a variable and the new project uses snake_case instead of camelCase.

You copied a title from a document that was typed in all capitals and you need it in title case for a web page.

You are writing CSS or file names and want kebab-case versions of words you already typed somewhere else.

You need environment variable names, which are usually written in constant case with underscores.

You pasted a paragraph where the capitals are inconsistent and want it reset to clean sentence case.

## How to use this tool

Paste or type your text into the input box. Every result updates as you type, so there is no button to press.

Scroll the list of results and find the case you want. Each row shows the full converted text.

Press Copy on that row to put it on your clipboard.

Press Clear to empty the box and start over. The counters above the results tell you how many characters, words and lines you are working with.

## Frequently asked questions

**Does it handle more than one word or line?**
Yes. Upper, lower, title and sentence case keep your line breaks and spacing as they are. The programming cases, such as camel and snake, treat the whole input as one name, so spaces and punctuation become separators and disappear from the result.

**How does it split a word like getUserName?**
It looks for the point where a lowercase letter meets a capital one, and treats that as a word boundary. Runs of capitals are handled too, so HTTPServer becomes three words: http, server. That means you can convert between programming cases in either direction.

**What happens to accents and non-Latin letters?**
They are kept. Upper and lower case follow the rules of your text, and letters that have no separate upper or lower form are passed through unchanged.

**Is my text uploaded anywhere?**
No. Everything runs in your browser, and nothing is sent to a server or stored after you close the page.
