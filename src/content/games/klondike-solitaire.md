---
title: "Klondike Solitaire"
description: "Sort a shuffled deck into four suit piles from ace to king, moving cards between seven columns and turning the deck when you run out of plays."
category: card
icon: "klondike-solitaire"
tags: [solitaire, cards, patience]
status: published
featured: false
publishedAt: 2026-10-08
component: "klondike-solitaire/KlondikeSolitaire"
difficulty: 2
playTime: 8
localizations:
  ko:
    title: "클론다이크 솔리테어"
    description: "섞인 카드 한 벌을 에이스부터 킹까지 네 개의 무늬별 더미로 정리합니다. 일곱 개의 열 사이로 카드를 옮기고, 놓을 곳이 없으면 덱을 넘깁니다."
---

## How it works

A full deck is dealt into seven columns, one card in the first and seven in the last. Only the final card of each column starts face up. The leftovers sit in the deck at the top left.

Your goal is the four piles on the top right. Each one takes a single suit, from ace up to king. Complete all four and you win.

Inside the columns you build downward in alternating colors. A black six goes on a red seven. A red four goes on a black five. You can move one card or a whole run that already follows that pattern. An empty column only accepts a king.

## Working the deck

Click the deck to turn one card onto the pile beside it. The top card of that pile is always available. When the deck runs out, click the empty space to turn the pile over and go through it again. Passes are unlimited, but each recycle costs 20 points.

Face-down cards flip up on their own once the card above them leaves. Those flips are the real work. A column with four hidden cards is dead weight, so prefer moves that uncover something new over moves that only shuffle visible cards.

## Scoring and tips

You earn 10 points for every card that reaches a suit pile, 5 for turning a card up in a column, and 5 for playing a card off the pile. Pulling a card back off a suit pile costs 15 points.

Do not send aces and twos home blindly. Low cards make useful landing spots in the columns. Empty a column early if you can, since an open column plus a king is the fastest way to unload a long run.

## Controls

Click a card to pick it up, then click where it goes. Double-click sends a card straight to its suit pile. Keys 1 through 7 pick a column, W picks the pile, D draws, F sends your selection home, A collects everything it can, U takes back a move, N deals again, and Escape clears the selection.

## Frequently asked questions

**Is every deal winnable?**
No. Roughly one deal in six cannot be solved, because key cards sit buried under each other. The game checks for a dead end after every move and tells you when one is reached, so you never guess whether to keep trying.

**Can I take back a move?**
Yes. The Undo button, or the U key, steps back one move at a time and restores your score along with the board. The last fifty moves are kept.

**What does the Collect button do?**
It sends every card that can legally go home to its suit pile, over and over, until nothing else fits. It is handy at the end of a game.

**Does my score carry over?**
Your best winning score shows while the page stays open. Nothing is saved once you reload.
