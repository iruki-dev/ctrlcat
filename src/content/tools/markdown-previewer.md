---
title: "Markdown Previewer"
description: "Write Markdown on the left and see the rendered result on the right, with word counts and a copyable HTML view."
category: text
icon: "markdown-previewer"
tags: [markdown, preview, writing, docs, html]
status: published
featured: false
publishedAt: 2026-09-24
component: "markdown-previewer/MarkdownPreviewer"
localizations:
  ko:
    title: "마크다운 미리보기"
    description: "왼쪽에 마크다운을 작성하면 오른쪽에 결과가 바로 나타납니다. 단어 수와 복사 가능한 HTML도 함께 제공합니다."
---

## What this is

Markdown is plain text with a few punctuation rules that stand in for formatting. A hash mark makes a heading, asterisks make a word bold, a dash starts a list item. The catch is that you cannot tell how the document will look until something renders it.

This previewer renders as you type. The raw text stays on the left, the formatted document sits on the right, and both stay in sync. Nothing is uploaded anywhere; the conversion happens in your browser.

## Where this is useful

- Checking a README before you push it to a repository, so the headings and tables come out the way you expect.
- Drafting a blog post or newsletter in Markdown and confirming the structure before pasting it into a publishing system.
- Writing release notes or changelogs where lists and tables need to line up.
- Reviewing a file someone else wrote when you only have the raw text and no rendered view.
- Grabbing plain HTML from a Markdown draft to drop into an email template or a page editor.

## How to use this tool

Type or paste your Markdown into the left panel. The right panel updates immediately, so there is no button to press.

Switch the right panel between Preview and HTML. Preview shows the formatted document. HTML shows the generated markup, which you can copy with the button above the panel.

If you want to see what the tool supports, press Load sample. It fills the editor with a document that uses headings, lists, a table, a quote, a code block and links. Press Clear to start over.

The counters below the panels track words, characters, lines and an estimated reading time based on 200 words per minute.

## Frequently asked questions

**Which Markdown features are supported?**
Headings, bold, italic, strikethrough, inline code, fenced code blocks, ordered and unordered lists including one level of nesting, blockquotes, horizontal rules, links, images and pipe tables with alignment. Raw HTML inside your Markdown is shown as text rather than rendered, which keeps the preview safe to use with files you did not write.

**Does my text leave my computer?**
No. Everything runs in the browser tab, and nothing is sent to a server or saved between visits. Closing the tab discards the draft, so keep your own copy of anything important.

**Will the preview match GitHub exactly?**
The structure will match, but the styling will not. Every site applies its own fonts, spacing and colors to rendered Markdown. Use this tool to confirm that your headings, lists and tables are correct, not to judge the final appearance.

**Can I use the HTML output directly?**
Yes. The HTML view gives you the markup with styling classes attached. If you need bare markup for another system, strip the class attributes after copying.
