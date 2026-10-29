---
title: "Hash Generator"
description: "Create SHA-1, SHA-256, SHA-384 and SHA-512 hashes from text or a file. Everything is computed in your browser, so nothing is uploaded."
category: developer
icon: "hash-generator"
tags: [hash, checksum, sha256, digest, file]
status: published
featured: false
publishedAt: 2026-10-29
component: "hash-generator/HashGenerator"
localizations:
  ko:
    title: "해시 생성기"
    description: "텍스트나 파일에서 SHA-1, SHA-256, SHA-384, SHA-512 해시를 만듭니다. 모든 계산은 브라우저에서 이루어지며 파일은 전송되지 않습니다."
---

## What this is

A hash is a short fingerprint of some data. Feed in the same text or the same file and you always get the same fingerprint back. Change a single character and the result looks completely different.

This tool turns text you type or a file you choose into that fingerprint. It supports the SHA-1, SHA-256, SHA-384 and SHA-512 families. The work happens inside your browser using the built-in cryptography support, so your text and your files never leave your computer.

## Where this is useful

Checking a download. Many projects publish a SHA-256 value next to their release files. Hash the file you downloaded and compare the two strings to confirm it arrived intact.

Spotting a change in a document or a configuration file. Record the hash today, hash the file again later, and you will know whether anything was edited.

Filling in a checksum field for a package manager or a deployment script.

Testing an application that compares hashes, when you need a known value to work against.

## How to use this tool

Pick the algorithm you need. SHA-256 is the usual default.

For text, type or paste it into the text box and press Generate. For a file, switch to the file tab and choose a file from your computer.

The result appears as a lowercase hexadecimal string. Use the copy button to put it on your clipboard.

To check a value you already have, paste it into the comparison box. The tool tells you whether it matches, ignoring differences in letter case and surrounding spaces.

## Frequently asked questions

**Is my file uploaded anywhere?**
No. The file is read by the page itself and hashed in memory on your machine. There is no server involved, and nothing is stored after you leave or reload the page.

**Which algorithm should I pick?**
SHA-256 unless you have a reason to do otherwise. SHA-384 and SHA-512 produce longer values and are also fine. SHA-1 is kept here because older tools and systems still publish SHA-1 values, but it is no longer considered safe for security purposes.

**Why does my result differ from another tool?**
Usually because of a hidden difference in the input, such as a trailing newline or a different text encoding. This tool reads text as UTF-8. Hashing the file itself, rather than its contents pasted as text, avoids the question entirely.

**Is there a size limit for files?**
The whole file is loaded into memory, so the limit is what your browser and device can hold. A few hundred megabytes is usually fine; much larger files may be slow or may fail.
