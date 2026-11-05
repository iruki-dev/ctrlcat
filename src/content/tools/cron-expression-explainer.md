---
title: "Cron Expression Explainer"
description: "Translate a cron expression into plain language and see the next several run times in your own time zone."
category: developer
icon: "cron-expression-explainer"
tags: [cron, schedule, crontab, devops]
status: published
featured: false
publishedAt: 2026-11-05
component: "cron-expression-explainer/CronExpressionExplainer"
localizations:
  ko:
    title: "크론 표현식 해설기"
    description: "크론 표현식을 쉬운 문장으로 바꾸고, 다음 실행 시각을 현재 시간대로 확인합니다."
---

## What this is

A cron expression is a line of five fields that tells a server when to run a job. The fields cover the minute, the hour, the day of the month, the month, and the day of the week. The syntax is compact, so a single wrong character can move a job from every weekday morning to every minute of every day.

This tool reads the expression you paste in, writes out what it means as a sentence, and lists the next run times using your device's time zone.

## Where this is useful

You are about to add a backup job to a crontab and want to confirm it runs nightly, not hourly.

You inherited a scheduled task from someone else and need to know when it actually fires before you change anything.

You are reviewing a pull request that edits a schedule, and the diff alone does not tell you whether the new timing is correct.

You want to check that a weekly report lands before a Monday meeting rather than after it.

You are teaching someone the field order and want a running example they can change and watch.

## How to use this tool

Type or paste your expression into the input at the top. The explanation updates as you type, so you do not need to press anything.

Read the plain-language sentence first. It is the quickest way to catch a mistake, such as a step value in the wrong field.

Then look at the list of upcoming run times. Change how many you want to see if you need a longer view, and press Refresh to recalculate from the current moment.

If the expression cannot be read, the tool says which field is the problem. Fix that field and the explanation returns.

The preset buttons fill in common schedules. They are a good starting point when you are not sure of the field order.

## Frequently asked questions

**Which cron syntax does this support?**
It reads the standard five-field format used by Unix crontab. Lists, ranges, steps, and month and weekday names such as JAN or MON all work. The shortcuts @hourly, @daily, @weekly, @monthly, and @yearly are expanded for you. Both 0 and 7 are accepted as Sunday.

**Which time zone are the run times in?**
Your device's time zone, which is shown in the summary above the list. Servers often run on UTC, so if your schedule lives on a server, compare the two before you trust the times.

**Why do a day of month and a day of week together give more runs than I expected?**
When both of those fields are restricted, cron treats them as alternatives rather than requirements. A job set for the first of the month and for Mondays runs on both, not only on a first that falls on a Monday.

**Does anything I type get sent anywhere?**
No. The expression is parsed in your browser, and nothing leaves your device.
