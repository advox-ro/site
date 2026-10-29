import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The research wiki lives at the repo root (wiki/*.md) so it reads well on GitHub too.
// Lowercase names only: wiki/README.md is the GitHub index, not a page.
const wiki = defineCollection({
  loader: glob({ pattern: '[a-z]*.md', base: '../wiki' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    updated: z.coerce.date(),
    order: z.number(),
  }),
});

// The manifesto lives at the repo root too, next to the code it describes.
const manifest = defineCollection({
  loader: glob({ pattern: 'MANIFEST.md', base: '..' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    version: z.string(),
    updated: z.coerce.date(),
  }),
});

// Question sets: what the feed shows (sets/README.md). A set takes its questions from the pool
// (ids) or writes its own (news sets), and its facts from a wiki page or from the news.
const option = z.object({ id: z.string(), label: z.string() });
const ownQuestion = z.object({
  id: z.string(),
  type: z.enum(['single', 'multi', 'scale', 'yesno']),
  measures: z.string(),
  text: z.string(),
  options: z.array(option).optional(),
  maxSelect: z.number().optional(),
  scale: z.object({ minLabel: z.string(), maxLabel: z.string() }).optional(),
  na: z.string().optional(),
  outlook: z.record(z.string(), z.number()).optional(), // evaluative questions: choice id -> -1..1 (questions/README.md)
  where: z.enum(['romania', 'diaspora']).optional(),
});
const sets = defineCollection({
  loader: glob({ pattern: '[a-z]*.md', base: '../sets' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).min(1),
    order: z.number().optional(),
    date: z.coerce.date().optional(), // news sets: the day of the news; they lead the feed
    counties: z.array(z.string()).optional(), // local sets: county codes (counties.ts), DSP for the diaspora; absent: everyone
    wiki: z.string().optional(),
    stat: z.object({ value: z.string(), label: z.string() }).optional(),
    image: z
      .object({ src: z.string(), alt: z.string(), credit: z.string(), license: z.string(), url: z.string(), illustrative: z.boolean().default(false) })
      .optional(),
    sources: z.array(z.number()).default([]),
    news: z.array(z.object({ outlet: z.string(), title: z.string(), url: z.string() })).default([]),
    questions: z.array(z.union([z.string(), ownQuestion])).min(4),
  }),
});

export const collections = { wiki, manifest, sets };
