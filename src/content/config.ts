import { defineCollection, z } from "astro:content";

const toolCategories = [
  "text", "math", "color", "data", "image",
  "developer", "productivity", "converter",
] as const;

const gameCategories = [
  "puzzle", "arcade", "strategy", "word",
  "number", "card", "trivia",
] as const;

const statusValues = ["published", "draft", "wip"] as const;

const localizationSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

const tools = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(toolCategories),
    icon: z.string(),
    tags: z.array(z.string()).default([]),
    status: z.enum(statusValues).default("published"),
    featured: z.boolean().default(false),
    publishedAt: z.coerce.date().optional(),
    component: z.string(),
    localizations: z.record(localizationSchema).optional(),
  }),
});

const games = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(gameCategories),
    icon: z.string(),
    tags: z.array(z.string()).default([]),
    status: z.enum(statusValues).default("published"),
    featured: z.boolean().default(false),
    publishedAt: z.coerce.date().optional(),
    component: z.string(),
    difficulty: z.number().min(1).max(5).default(3),
    playTime: z.number().optional(),
    localizations: z.record(localizationSchema).optional(),
  }),
});

/**
 * Locale-specific documentation bodies.
 * Slug convention: tools/<tool-slug>/<lang> or games/<game-slug>/<lang>
 * Example: tools/word-counter/ko → src/content/docs/tools/word-counter/ko.md
 */
const docs = defineCollection({
  type: "content",
  schema: z.object({
    /** "tool" or "game" */
    kind: z.enum(["tool", "game"]),
    /** slug of the parent tool/game */
    ref: z.string(),
    lang: z.string(),
  }),
});

export const collections = { tools, games, docs };
