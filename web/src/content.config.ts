import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The manifesto lives at the repo root, next to the code it describes. The wiki comes from the
// redactor (lib/redactor.ts).
const manifest = defineCollection({
  loader: glob({ pattern: 'MANIFEST.md', base: '..' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    version: z.string(),
    updated: z.coerce.date(),
  }),
});

export const collections = { manifest };
