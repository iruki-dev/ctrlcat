---
title: "URL Encoder / Decoder"
description: "Encode and decode URLs and query string values right in your browser. Handles percent-encoding for special characters, spaces, and non-English text."
category: developer
icon: "url-encoder-decoder"
tags: [url, encode, decode]
status: published
featured: false
publishedAt: 2026-09-21
component: "url-encoder-decoder/UrlEncoderDecoder"
localizations:
  ko:
    title: "URL 인코더 / 디코더"
    description: "브라우저 안에서 URL과 쿼리 문자열 값을 인코딩하고 디코딩합니다. 특수문자, 공백, 한글 같은 비영어 문자의 퍼센트 인코딩을 처리합니다."
---

## What this is

A URL can only carry a limited set of characters. Anything outside that set, such as a space or an ampersand, has to be rewritten as a percent sign followed by two hex digits. That rewriting is called percent-encoding, and it is what turns `hello world` into `hello%20world`.

This tool converts text in both directions. Paste something in, choose encode or decode, and read the result. Everything runs in your browser.

## Where this is useful

You are debugging an API call and need to know what the server actually received after a query string was encoded.

You are building a link that carries a search term with spaces, quotes, or a plus sign, and you need the term encoded before you paste it into the URL.

You copied a long tracking link from an email and want to read the campaign parameters hidden behind `%3F` and `%3D`.

You received a redirect target that was encoded twice and want to peel it back one layer at a time.

## How to use this tool

Paste or type your text into the input box. Pick a direction, Encode or Decode, using the buttons above the box.

Choose a scope. Component encodes every reserved character, which is what you want for a single query value or path segment. Full URL leaves the structural characters such as the slash, the question mark, and the ampersand alone, so a complete address stays usable.

The result appears below as you type. Copy it to your clipboard, or use Swap to move the result back into the input for another pass.

## Frequently asked questions

**What is the difference between Component and Full URL?**
Component treats your text as one value, so characters like `&`, `=`, `/`, and `?` are all encoded. Full URL assumes you handed it a whole address and preserves those characters, encoding only what would otherwise break the link. If you are encoding a single query parameter, pick Component.

**Why do spaces sometimes become a plus sign instead of %20?**
Older HTML form submissions encode a space as `+`, while percent-encoding uses `%20`. Both appear in the wild. This tool writes `%20`, and when decoding you can turn on the plus option so `+` is read back as a space.

**What does it mean when decoding fails?**
A percent sign must be followed by two valid hex digits. If the text contains a stray `%` or a truncated sequence, the decoder cannot tell what byte was intended, and the tool reports the input as malformed rather than guessing.

**Is my text uploaded anywhere?**
No. The conversion happens entirely in your browser using built-in functions. Nothing leaves the page.
