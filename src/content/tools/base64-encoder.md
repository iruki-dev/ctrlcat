---
title: "Base64 Encoder / Decoder"
description: "Encode text or binary data to Base64 and decode Base64 strings back to plain text — free, instant, no data leaves your browser."
category: developer
icon: "base64-encoder"
tags: [base64, encode, decode, binary, developer tool]
status: published
featured: true
publishedAt: 2026-05-12
component: "base64-encoder/Base64Encoder"
localizations:
  ko:
    title: "Base64 인코더 / 디코더"
    description: "텍스트나 데이터를 Base64로 인코딩하거나 Base64 문자열을 디코딩합니다. 브라우저에서 즉시 처리됩니다."
---

## What is Base64?

Across the internet, you occasionally encounter long strings made up of only letters, numbers, and a few symbols — something like "SGVsbG8gV29ybGQ=". That is Base64-encoded text. The original phrase "Hello World" has been converted to use only 64 safe characters: uppercase A–Z, lowercase a–z, digits 0–9, plus (+) and slash (/).

The name comes from those 64 characters. They were chosen because they survive unchanged as data travels through email servers, web systems, and databases — systems that historically handled other characters unpredictably.

## Why does it exist?

Before the internet became standardized, different computer systems treated data differently. Some email servers would silently alter certain bytes, causing files and images to arrive corrupted. Base64 was designed to solve this: by converting any data into those 64 safe characters, it can pass through any system without being modified.

Today you will encounter Base64 mainly in web pages that embed images directly in HTML, JWT tokens (the strings that carry login state between a browser and a server), API responses that include file data, and anywhere someone has encoded text to obscure it at a glance.

## An important distinction

Base64 is not encryption. Anyone who receives an encoded string can decode it immediately — no key or password needed. It is packaging for safe transport, not a way to keep secrets. If you see a Base64 string and assume the content is protected, it is not.

The encoding also increases size by about 33%: every three bytes become four characters. A small overhead, accepted in exchange for reliable delivery.

## How to use this tool

To encode: select the Encode tab, paste or type your text, and click Encode. The result appears below.

To decode: select the Decode tab, paste a Base64 string, and click Decode. The original text is restored.

The Swap button moves the result back into the input for chained operations. Copy saves the result to your clipboard.

## Frequently asked questions

**Why does the output sometimes end with "=="?**
Base64 processes data in groups of three bytes. If the last group is short, it pads the gap with = signs. One = means one byte was missing; == means two were missing.

**Can I decode a JWT token here?**
JWT uses a variant called Base64url, where + is replaced with - and / is replaced with _. Before decoding, swap those characters back, then try decoding.

**The decoded output looks like garbled characters. What happened?**
If the original data was a binary file (an image, for example), decoding it as text will produce unreadable characters. Base64 decoding only produces readable text when the original was text to begin with.
