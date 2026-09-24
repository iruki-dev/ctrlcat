---
title: "Minesweeper"
description: "Clear a grid of hidden mines using number clues. Reveal every safe tile and flag the mines without a single wrong click."
category: puzzle
icon: "minesweeper"
tags: [puzzle, logic, grid, classic, mines]
status: published
featured: false
publishedAt: 2026-09-24
component: "minesweeper/Minesweeper"
difficulty: 3
playTime: 5
localizations:
  ko:
    title: "지뢰찾기"
    description: "숫자 단서로 숨겨진 지뢰를 피해 격자를 정리하세요. 안전한 칸을 모두 열고 지뢰에는 깃발을 꽂으면 승리합니다."
---

## How it works

Every board hides a fixed number of mines under a grid of tiles. You open tiles one at a time, and each safe tile shows a number. That number counts the mines touching it, including the diagonals. A blank tile touches no mines at all, so the board opens up around it automatically.

Your first click is always safe. The mines are placed after you open that first tile, and they avoid the tiles right next to it too. You win when every safe tile is open. You lose the moment you open a mine.

## Reading the numbers

The whole game lives in the border between open and closed tiles. Look at a number, then count the closed tiles around it. If a 2 touches exactly two closed tiles, both of them are mines, so flag them. If a 2 already touches two flags, every other closed tile around it is safe to open.

Pairs of numbers tell you more than single ones. When a 1 and a 2 share the same closed tiles, the overlap usually forces one answer. Work the edges and corners first, since those tiles have fewer neighbours.

## Flags and chording

Flags are your notes. They do not open anything, but they mark a tile as dangerous so you do not click it by accident. The counter at the top shows mines left, so it drops as you place flags.

Once a number has all of its mines flagged, you can click that number again to open every remaining tile around it in one move. This is called chording, and it is the fastest way to sweep a solved section. It only fires when the flag count matches the number exactly.

## Controls

Click a tile to open it. Right-click or long-press to flag it. Turn on flag mode to flag with plain taps on a touch screen. Arrow keys move the cursor, Enter opens, and F flags.

## Frequently asked questions

**Can I lose on the first click?**
No. The mines are laid out after your first tile is open, and the tiles around it are kept clear as well.

**What do the three board sizes change?**
They change the grid and the mine count. Easy is eight by eight with ten mines, medium is ten by ten with eighteen, and hard is twelve by twelve with thirty.

**Do I have to flag every mine to win?**
No. You win by opening all the safe tiles. The game marks the remaining mines for you once the last safe tile is open.

**Why did my chord click blow up the board?**
Chording trusts your flags. If a flag around that number sits on a safe tile, the real mine is still hidden among the tiles it opens.
