import type { APIRoute } from 'astro';
import { wikiPages } from '../lib/redactor';

export const prerender = false;

// The wiki's pages, rendered on request and so missing from the built sitemap, which links here
// (astro.config.mjs). Each with the day it was last updated.
export const GET: APIRoute = async ({ site }) => {
  const urls = (await wikiPages()).map((p) => `<url><loc>${new URL(`/wiki/${p.slug}`, site).href}</loc><lastmod>${p.data.updated.toISOString().slice(0, 10)}</lastmod></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
