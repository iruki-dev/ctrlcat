---
title: "Timestamp Converter"
description: "Convert Unix timestamps into readable dates in UTC, your local timezone and ISO 8601, and turn any date back into a timestamp."
category: converter
icon: "timestamp-converter"
tags: [timestamp, unix, epoch, date, time]
status: published
featured: false
publishedAt: 2026-11-05
component: "timestamp-converter/TimestampConverter"
localizations:
  ko:
    title: "타임스탬프 변환기"
    description: "유닉스 타임스탬프를 UTC, 현지 시간대, ISO 8601 형식의 읽을 수 있는 날짜로 변환하고, 날짜를 다시 타임스탬프로 바꿉니다."
---

## What this is

A timestamp converter turns a Unix timestamp into a date you can read, and turns a date back into a timestamp. Unix time counts the time that has passed since 1 January 1970 at midnight UTC. Logs, databases and web APIs store time this way because a single number is easy to store, sort and compare. Everything here runs in your browser, in both directions.

## Where this is useful

Reading a server log that prints a bare number instead of a date. Checking whether a token, session or cache entry has already expired. Comparing a timestamp from an API response against the current time. Filling in a timestamp field in a database query or a test fixture. Working out what a millisecond value from a program means in your own timezone.

## How to use this tool

Paste your number into the timestamp box. The tool guesses the unit from the size of the number, and you can override that guess with the unit buttons next to it. The results appear below in UTC, in your local timezone and in ISO 8601 form, each with its own copy button.

To go the other way, type a date into the second box and read the timestamp underneath it. The current time panel at the top updates every second, so you can take a fresh value whenever you need one.

## Frequently asked questions

**How does the tool know whether my number is seconds or milliseconds?**
It compares the size of the number against the range each unit covers for dates near today. Ten digits is almost always seconds, thirteen is almost always milliseconds, and longer values are read as microseconds or nanoseconds. The detected unit is shown next to the result, and you can set it by hand if the guess is wrong.

**Which timezone do the results use?**
Both. The UTC lines are independent of where you are, and the local lines use the timezone your device reports, which is named in the current time panel. The ISO 8601 line carries your offset from UTC so the value stays unambiguous when you paste it elsewhere.

**What should I type in the date box?**
An ISO date such as 2026-11-05T09:30:00 works, and so does a plain date, a date with a space before the time, or a value with a trailing Z or offset. If the text cannot be read as a date, the tool says so instead of showing a result.

**Why does a date with no time come out at midnight UTC?**
A date on its own has no time of day, so it is read as the start of that day in UTC rather than in your timezone. Add a time to the text if you want the value interpreted locally.
