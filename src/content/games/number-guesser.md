---
title: "Number Guesser"
description: "Guess the secret number between 1 and 100 in as few tries as possible. A free browser game that teaches binary search intuition."
category: number
icon: "number-guesser"
tags: [number guessing, binary search, logic game, math game, puzzle]
status: published
featured: true
publishedAt: 2026-05-12
component: "number-guesser/NumberGuesser"
difficulty: 2
playTime: 2
localizations:
  ko:
    title: "숫자 맞추기"
    description: "1부터 100 사이의 숫자를 최소 횟수로 맞춰보세요. 이진 탐색 직관을 키워주는 무료 브라우저 게임."
---

## How the game works

The computer picks a secret number between 1 and 100. You guess one number at a time and get a hint after each attempt: "higher" or "lower." You have 7 guesses to find the answer.

It sounds simple, but the 7-guess limit is not arbitrary. There is a mathematical reason that number is exactly right.

## Why 7 guesses is enough

The best strategy is to always guess the midpoint of the remaining range. Start with 50. If the answer is higher, the range narrows to 51–100. If it is lower, the range becomes 1–49. One guess cuts the possibilities in half.

Keep applying this strategy, and 7 guesses is always enough to find any number from 1 to 100. This is the same method computer scientists call binary search — halving the search space at each step.

You see the same principle in everyday life: flipping to the middle of a thick book to find a page, or checking the center of a sorted list to find a name.

## Strategy tips

Always start with 50. It is the midpoint of the full range and gives you the most information from your first guess. After each hint, aim for the middle of the remaining range shown on screen.

For example, if hints have narrowed the range to 63–74, your next guess should be around 68 (the midpoint of 63 and 74). When the range has an odd number of values, either middle choice works equally well.

## Scoring

Fewer guesses is better. Getting it in one is pure luck. Getting it in 7 is always achievable with the right strategy. Your best score carries over between rounds and stays until you close or refresh the tab.

## Frequently asked questions

**Is the number truly random?**
Yes. The browser's random number generator picks a number evenly distributed across 1–100 at the start of each round. There is no pattern and no influence from previous games.

**Why 7 and not 6 or 8?**
With the halving strategy, 7 guesses covers every possible number from 1 to 100. Six would leave some numbers unreachable no matter how well you play. Eight would give you more room than you need.

**Can I guess the same number twice?**
Technically yes, but you will waste a guess with no new information. Use the hint history and the range bar on screen to track what you have already tried.
