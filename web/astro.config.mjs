// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { satteri } from '@astrojs/markdown-satteri';

// https://astro.build/config
export default defineConfig({
  site: 'https://advox.ro',
  // Clean URLs: /wiki/sanatate, not /wiki/sanatate/ (pages build to .html files).
  trailingSlash: 'never',
  build: { format: 'file' },

  integrations: [
    react(),
    // The built pages, without the older quiz and results. The wiki's pages are rendered on request
    // (they come from the redactor), so they have their own sitemap (src/pages/sitemap-wiki.xml.ts).
    sitemap({ filter: (page) => !/\/(quiz|r)(\/|$)/.test(new URL(page).pathname), customSitemaps: ['https://advox.ro/sitemap-wiki.xml'] }),
  ],

  markdown: {
    // The manifesto (/mission). The wiki is rendered by the redactor with the same processor.
    processor: satteri()
  },

  vite: {
    plugins: [tailwindcss()]
  },

  // Remote bindings (wrangler.jsonc, the redactor's) only for `astro dev`: on localhost the site reads
  // the deployed redactor; the build needs no connection to Cloudflare.
  adapter: cloudflare({ remoteBindings: process.argv.includes('dev') })
});
