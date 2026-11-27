---
title: "Snake"
description: "The classic snake game. Eat food to grow longer and keep clear of the walls and your own tail."
category: arcade
icon: "snake"
tags: [arcade, classic, snake, canvas, reflex]
status: published
featured: true
publishedAt: 2026-05-13
component: "snake/Snake"
difficulty: 2
playTime: 5
localizations:
  ko:
    title: "스네이크"
    description: "고전 뱀 게임입니다. 먹이를 먹으면 길어지고, 벽이나 자기 꼬리에 부딪히면 끝납니다."
---

## How it works

The snake moves on its own in a fixed direction. Use the arrow keys, WASD, or a swipe gesture to turn. You cannot stop the snake, only steer it. Touch a wall or cross your own body and the game ends immediately.

Each piece of food you eat adds one point and makes the snake one cell longer. The longer it grows, the harder it becomes to maneuver without running out of room.

## Score and speed

Every piece of food adds one point. As your score climbs, the snake moves faster, gradually at first and then noticeably. High scores require both quick reflexes and the ability to plan the next few moves while the snake is still in motion.

Your best score for each speed setting (Easy, Normal, Hard, Insane) is saved in this browser, so it is still there next time.

## How to get a high score

The core challenge is not running out of space. As the snake grows, each turn reduces future options. A player reacting only to what is directly ahead will find the snake has surrounded itself with no way out.

A practical approach: think in paths rather than individual moves. Moving in rough spirals or deliberate U-turns lets you cover the grid without cutting off large sections. You do not have to take every food dot at the first opportunity. Sometimes a longer route that keeps the board open is better than the shortcut that traps you.

When the snake starts hemming itself in, redirect toward open space immediately, even if it means delaying a food pickup. The goal is survival first, score second.

## Controls

Arrow keys or WASD on a keyboard. On a touchscreen, swipe in any direction; there are no buttons to press. Quick turns are remembered in order, so a fast double turn is never lost. Press Space, P, or Esc (or the pause button) to pause; the game also pauses when you switch tabs.

## Frequently asked questions

**Why does the food sometimes appear somewhere inconvenient?**
Food spawns at a random empty cell on the grid. It cannot appear on your snake, but the placement does not account for difficulty, so some spots will be harder to reach than others.

**Does speed increase with length or score?**
Speed is tied to score, not directly to length. Since eating food raises both at once, they feel the same, but it is your score that controls how fast the snake moves.

**Is there a maximum score?**
The board has about 380 cells, and its shape follows your screen: wider on a landscape screen, taller on a phone. Starting from a length of 3, the theoretical maximum is the number of cells minus 3, and filling the whole board ends the run as a win. Getting close requires near-perfect movement for an extended run.

**Does it work on mobile?**
Yes. Swipe anywhere on the game area to turn. The game is the same on touchscreen as on a keyboard.
