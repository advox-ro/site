import type { APIRoute } from 'astro';
import { renderWikiPreview } from '../../../lib/og-wiki';
import { wikiPage } from '../../../lib/redactor';

export const prerender = false;

// A wiki page's link preview, cached at the edge for an hour: a page's title changes only when the
// redactor publishes it again. Keyed by the slug alone, so a query string can't make it render again.
export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.slug ?? '';
  const cache = typeof caches === 'undefined' ? null : (caches as unknown as { default: Cache }).default;
  const key = new Request(`${url.origin}/og/wiki/${encodeURIComponent(slug)}.png`);
  const hit = await cache?.match(key);
  if (hit) return hit;

  const page = /^[a-z0-9-]+$/.test(slug) ? await wikiPage(slug) : null;
  if (!page) return new Response('Nu am găsit pagina.', { status: 404 });
  const png = await renderWikiPreview(page.data.title);
  const res = new Response(png as Uint8Array<ArrayBuffer>, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
  await cache?.put(key, res.clone());
  return res;
};
