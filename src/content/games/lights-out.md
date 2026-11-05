---
title: "Lights Out"
description: "Tap cells to flip a light and its four neighbours, and turn the whole grid dark before you run out of taps."
category: puzzle
icon: "lights-out"
tags: [lights-out, grid, logic, toggle, puzzle]
status: published
featured: false
publishedAt: 2026-11-05
component: "lights-out/LightsOut"
difficulty: 3
playTime: 5
localizations:
  ko:
    title: "라이트 아웃"
    description: "칸을 누르면 그 칸과 상하좌우 네 칸의 불이 함께 바뀝니다. 탭 횟수가 떨어지기 전에 격자를 전부 어둡게 만드세요."
---

## How it works

You start with a grid where some cells are lit. Tapping a cell flips it and the four cells directly above, below, left and right. Cells on an edge have fewer neighbours to flip.

The level is cleared the moment every light is off. Each level gives you a fixed number of taps, shown as "Taps left"; run out while lights are still on and the run ends. A set runs six levels, from three by three up to five by five.

## Why order does not matter

Each tap is its own opposite. Tap the same cell twice and the grid returns to exactly where it was. A solution is just a set of cells to press once each, and the order does not change the result.

So you never need to plan a sequence, only work out which cells belong in the set. Repeating a cell wastes two taps and gets you no closer.

## Tips and scoring

Work from the top row downward. For any light still on in the top row, press the cell directly below it. That clears the row. Repeat on the second row and the third, and the lit cells get pushed toward the bottom. When only the last row is lit, a few presses in the top row finish it.

The "Par" above the grid is the shortest solution for that layout, and your allowance sits a few taps above it. Points come from the taps you do not use. Clearing a level is worth 100 points, plus 20 for every tap you had left over. A short, clean solution is worth more than a lucky one, so look at the grid before your first tap.

## Controls

Click or tap a cell to flip it. Arrow keys move the highlighted cell; Enter or Space presses it. Press R to restart the level with a fresh layout.

## Frequently asked questions

**Is every level solvable?**
Yes. Each grid is built from a fully dark board by pressing a handful of random cells, so pressing that same set again always clears it. The game works out the shortest solution and sets your allowance above it, leaving room for a few wrong turns.

**What happens if I press the same cell twice?**
The grid returns to the state it was in before those two presses, and you have spent two taps for nothing. Undoing a mistake costs the same as making it.

**Do bigger grids need more presses?**
Usually, but not always. A five by five grid can start with only a few lights on and clear in a handful of presses. Each level's allowance is matched to the par of that grid, so an easy layout gives fewer spare taps.

**Can I skip a level I am stuck on?**
No, the six levels run in order. Press R for a fresh layout of the same size: that resets your taps for the level but keeps the score you have banked.
