---
title: "Connect Four"
description: "Drop discs into a seven-column grid and line up four in a row before the computer does. Rows, columns and diagonals all count."
category: strategy
icon: "connect-four"
tags: [strategy, grid, classic, logic]
status: published
featured: false
publishedAt: 2026-10-15
component: "connect-four/ConnectFour"
difficulty: 3
playTime: 6
localizations:
  ko:
    title: "커넥트 포"
    description: "일곱 칸 격자에 원판을 떨어뜨려 컴퓨터보다 먼저 네 개를 연결하세요. 가로, 세로, 대각선 모두 인정됩니다."
---

## How it works
The grid has seven columns and six rows. You pick a column, and your disc falls to the lowest empty cell in it. The computer then picks a column of its own, and you take turns until someone connects four discs or the grid fills up.

Four in a row wins. The line can run sideways, straight up, or along either diagonal. Your discs are purple and the computer plays pink, so you can always see which threats belong to whom. The winning four are outlined when the game ends.

## Reading threats before they land
Because discs stack, the useful question is not only where a cell is but when it becomes reachable. A gap that sits three rows above the pile is harmless for now. A gap one row above the pile is urgent, because your next move hands it over.

That is why the centre column matters so much. A disc in the middle can belong to more possible lines than one on the edge, so early centre play gives you more ways to win later. The computer knows this too and will usually fight you for the middle.

## Tips and scoring
Watch for the double threat. If one move creates two separate places where you could complete four, your opponent can only block one of them. Setting up a double threat is the most reliable way to beat the computer, and spotting its own double threats early is the only way to stop them.

Be careful about the row directly above a square you want. Playing there to block something small can lift the stack and let the other side drop a winner on top. When a column is dangerous, play elsewhere until you have no choice.

The scoreboard keeps a running count of your wins and the computer's wins for the session, plus how many moves you have played in the current game. Fewer moves means a sharper win, though a win is a win at any length.

## Controls
Click a column to drop a disc, or use the left and right arrow keys to move the marker and Enter to drop. The marker above the grid shows which column is selected. Restart starts a fresh game at any time.

## Frequently asked questions
**Can the computer be beaten?**
Yes. It searches several moves ahead and will punish an obvious mistake, but it is not perfect. Taking the centre early and building toward a double threat gives you good chances.

**Who moves first?**
You always move first, which is a genuine advantage in this game. Use it to claim a centre cell.

**What happens if nobody connects four?**
The game ends in a draw once all forty-two cells are filled. Neither score goes up.

**Does the game remember my record?**
The counts last for as long as you keep the page open. Reloading starts both tallies at zero again.
