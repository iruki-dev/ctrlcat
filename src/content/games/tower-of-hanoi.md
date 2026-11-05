---
title: "Tower of Hanoi"
description: "Move a stack of discs from the left peg to the right peg, one disc at a time, never setting a larger disc on a smaller one."
category: puzzle
icon: "tower-of-hanoi"
tags: [hanoi, discs, pegs, logic, planning]
status: published
featured: false
publishedAt: 2026-11-05
component: "tower-of-hanoi/TowerOfHanoi"
difficulty: 3
playTime: 4
localizations:
  ko:
    title: "하노이의 탑"
    description: "원판을 한 번에 하나씩 옮겨 왼쪽 기둥의 탑을 오른쪽 기둥으로 통째로 옮기세요. 큰 원판은 작은 원판 위에 올릴 수 없습니다."
---

## How it works

You start with a neat stack of discs on the left peg. The widest disc sits at the bottom and each disc above it is a little narrower. Your job is to rebuild that exact stack on the right peg.

Two rules shape every move. You may only carry the top disc of a peg, and you may never place a disc on top of a smaller one. The middle peg is not a detour you should avoid. It is the workspace that makes the puzzle solvable at all.

## Why the middle peg matters

Think of the stack in layers instead of single discs. To move the bottom disc to the right peg, everything above it has to be parked somewhere else first, and the only place left is the middle peg. So each puzzle hides a smaller copy of itself.

That pattern repeats all the way down. Move the top group aside, shift the big disc across, then bring the group back on top of it. Once you see the puzzle this way, the move order stops feeling like guesswork.

## Scoring and the minimum

Every disc count has a shortest possible solution, and the game shows that number beside your move counter. Three discs need seven moves. Four need fifteen. Each extra disc roughly doubles the work.

Finishing at all is a win. Finishing in exactly the minimum is a clean win, and the game marks it. Your best result for each disc count is kept while you play, so you can retry the same size and try to shave moves off. Undo is there for slips, and it rolls your move counter back too.

## Controls

Click or tap a peg to lift its top disc, then click another peg to drop it. Press 1, 2, or 3 to do the same with the keyboard. Press U to undo, Escape to cancel a lift, and R to reset the board.

## Frequently asked questions

**How many discs should I start with?**
Three discs are enough to learn the rhythm in under a minute. Four or five give you a real puzzle without a long grind. Six and seven are there once the pattern feels automatic, and they reward planning several moves ahead.

**Can I get stuck with no legal move?**
No. There is always at least one legal move available, so you can never dead-end the board. You can still wander far off the shortest path, which is why the minimum counter is shown while you play.

**Does undo cost me anything?**
Undo removes the last move and lowers your move count, so it will not inflate your score. It does mean a perfect run is still possible after a misstep you immediately take back.

**Is there a trick to always hitting the minimum?**
Yes. With an odd number of discs, your first move sends the smallest disc to the right peg. With an even number, send it to the middle peg instead. Keep alternating between moving the smallest disc and making the only other legal move, and you will land on the shortest solution.
