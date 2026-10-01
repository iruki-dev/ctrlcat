---
title: "Sudoku"
description: "Fill a 9x9 grid so every row, column, and 3x3 box holds the digits 1 through 9 exactly once. Pick a difficulty and solve at your own pace."
category: number
icon: "sudoku"
tags: [sudoku, numbers, logic]
status: published
featured: false
publishedAt: 2026-10-01
component: "sudoku/Sudoku"
difficulty: 4
playTime: 10
localizations:
  ko:
    title: "스도쿠"
    description: "9x9 격자의 모든 가로줄, 세로줄, 3x3 상자에 1부터 9까지의 숫자가 정확히 한 번씩 들어가도록 채우세요. 난이도를 고르고 천천히 풀어 보세요."
---

## How it works

You start with a 9x9 grid that is partly filled in. The given numbers are fixed and cannot be changed. Your job is to fill every empty square so that each row, each column, and each of the nine 3x3 boxes contains the digits 1 through 9 exactly once.

Select a square, then choose a digit. Every puzzle has exactly one solution, so you never need to guess. If you place a digit that clashes with another digit in the same row, column, or box, the conflict is marked in red right away. You can clear a square at any time and try something else.

## Reading the grid

The fastest openings come from scanning rather than calculating. Look for a row, column, or box that already has seven or eight numbers filled in. The missing digits there are forced, and placing them often unlocks the squares next to them.

Another reliable move is to pick a single digit and hunt for it across the whole grid. If a box has only one square left where that digit can legally go, it belongs there. Working digit by digit this way keeps you moving even when no single square looks obvious.

## Notes and difficulty

Switch to notes mode when a square has two or three candidates and you are not ready to commit. Notes let you pencil small digits into a square and remove them as you rule them out. They do not count as answers, so a square full of notes still shows as empty.

Four difficulty levels change how many squares you begin with. Easy leaves most of the grid filled and rewards simple scanning. Hard and expert strip the grid down and ask you to chain several deductions together. The timer and the mistake count are shown while you play, so you can aim for a clean solve or a fast one.

## Controls

Click or tap a square to select it. Use the arrow keys to move the selection and the number keys 1 through 9 to place a digit. Press 0, Backspace, or Delete to clear a square, and press N to toggle notes mode.

## Frequently asked questions

**Do I ever have to guess?**
No. Every puzzle is generated with a single solution that can be reached by logic alone. If a square feels impossible, the information you need is somewhere else in the grid.

**What happens when I make a mistake?**
The square turns red and the mistake counter goes up, but nothing stops you. You can leave the wrong digit in place while you think, or clear it and move on. The puzzle is only complete when all 81 squares are correct.

**Can I get a new puzzle without finishing this one?**
Yes. Quit back to the menu at any point and start a fresh puzzle at the same or a different difficulty. Your best time for each level is kept while the page stays open.
