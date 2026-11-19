---
title: "Mastermind"
description: "Crack a hidden four-colour code in ten guesses. Each guess returns peg feedback that tells you how close you are."
category: puzzle
icon: "mastermind"
tags: [mastermind, deduction, logic]
status: published
featured: false
publishedAt: 2026-11-19
component: "mastermind/Mastermind"
difficulty: 3
playTime: 5
localizations:
  ko:
    title: "마스터마인드"
    description: "숨겨진 네 칸 색 코드를 열 번의 추측 안에 맞혀 보세요. 추측마다 정답에 얼마나 가까운지 알려주는 피드백이 돌아옵니다."
---

## How it works

The game hides a secret code made of four pegs. Each peg is one of six colours, and colours can repeat. Your job is to work out the exact code, in the exact order, within ten guesses.

Fill the active row with four colours and submit it. The game then answers with small feedback pegs. A dark peg means one of your colours is the right colour in the right slot. A hollow peg means a colour appears in the code but sits somewhere else. The feedback never tells you which slot it refers to, so the order of the feedback pegs carries no information.

## Reading the feedback

Every row you submit stays on the board, so you can compare answers as you go. The trick is to change one thing at a time once you have a foothold. If you swap two pegs and the count of dark pegs rises, you just learned something about position. If the total number of pegs stays the same but dark and hollow trade places, your colour set is right and only the order is wrong.

A guess with four of the same colour is wasteful early on, but it does tell you exactly how many times that colour appears. Many players spend their first two guesses counting colours, then spend the rest arranging them. Both approaches work. Ten guesses is enough room to be systematic rather than lucky.

## Scoring

You score points for solving the code and for solving it early. Each unused guess is worth extra, so a code cracked on the fourth row beats the same code cracked on the ninth. Your best score of the session is kept beside the current one.

If you run out of guesses, the secret code is revealed so you can see where your reasoning went wrong. That round scores nothing.

## Controls

Click a colour to place it in the next empty slot, or press the number keys one through six. Click a placed peg to remove it. Backspace removes the last peg, and Enter submits a full row.

## Frequently asked questions

**Can the same colour appear twice in the code?**
Yes. Every slot is chosen independently, so the code may contain repeats, and it may even be four of a kind. Assuming all four colours are different is the most common early mistake.

**Does the order of the feedback pegs mean anything?**
No. The dark pegs are always shown first, purely for readability. Nothing about their arrangement points at a particular slot.

**Is every code solvable in ten guesses?**
Yes. With careful deduction, any code can be found well inside ten rows, so a loss means a guess was wasted rather than that the code was unfair.

**What happens if I submit an incomplete row?**
Nothing. The submit control stays disabled until all four slots hold a colour, so you cannot lose a guess by accident.
