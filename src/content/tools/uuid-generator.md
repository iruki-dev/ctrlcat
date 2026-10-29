---
title: "UUID Generator"
description: "Generate random version 4 UUIDs one at a time or in bulk, with optional uppercase, hyphen-free, and braced formats."
category: developer
icon: "uuid-generator"
tags: [uuid, guid, generator, id, random]
status: published
featured: false
publishedAt: 2026-10-29
component: "uuid-generator/UuidGenerator"
localizations:
  ko:
    title: "UUID 생성기"
    description: "버전 4 UUID를 하나씩 또는 한꺼번에 생성합니다. 대문자, 하이픈 제거, 중괄호 형식을 선택할 수 있습니다."
---

## What this is

A UUID is a long identifier that is meant to be unique without asking a central server for permission. Version 4 UUIDs get that uniqueness from random numbers, so two generated values practically never collide. This page creates them in your browser using the built-in cryptographic random number generator.

Nothing is sent anywhere. The values appear only on your screen, and reloading the page discards them.

## Where this is useful

You need a primary key for a row you are inserting into a database by hand.

You are writing a test fixture and want an identifier that looks realistic instead of 1234.

You are naming a resource in a configuration file and want a value nobody else will reuse.

You need a correlation identifier to trace one request through several log files.

## How to use this tool

Choose how many identifiers you want. One is the default, and you can ask for up to five hundred at a time.

Pick the formatting you need. Uppercase switches the letters from lowercase to uppercase. Hyphens can be removed if the field you are pasting into expects a plain thirty-two character string. Braces wrap each value in curly brackets, which is the style some Windows and .NET tools expect.

Press Generate. Each value appears in the list below, and the copy button next to a value puts just that one on your clipboard. The button above the list copies every value, one per line.

Press Generate again whenever you want a fresh batch. Clear empties the list.

## Frequently asked questions

**Are these UUIDs really unique?**
They are random rather than coordinated, so uniqueness is a matter of probability. The odds of a repeat are small enough that the software industry treats these values as unique in practice.

**Is anything stored or sent to a server?**
No. The values are produced in your browser and exist only in that page. Close the tab and they are gone, so copy anything you want to keep.

**Why do all the values have a 4 in the same place?**
That digit marks the version. Every version 4 UUID carries it, along with one of the characters 8, 9, a, or b at the start of the fourth group. Those two markers tell other software that the rest of the value is random.

**Can I use these as passwords or secret tokens?**
They come from a cryptographic random source, so the randomness is sound, but UUIDs are designed to be shared and often end up in logs and URLs. Use a dedicated secret for anything that needs to stay private.
