// A page's cover photo, from the redactor, which publishes it with the page (lib/pages.ts). Shrunk
// to at most 1200 pixels wide, enough for a phone's screen, so the feed doesn't download photos
// several times larger than it shows. Each one is shrunk once and kept in Cloudflare's cache.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { photoOf } from '../../lib/pages';

export const prerender = false;

const WIDTH = 1200;
const headers = { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' };

export const GET: APIRoute = async ({ params, request, locals }) => {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL(request.url).origin + new URL(request.url).pathname);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await photoOf(params.file ?? '');
  if (!res?.body) return new Response('not found\n', { status: 404 });
  const photo = await res.arrayBuffer();
  let body: BodyInit = photo;
  try {
    const out = await env.PHOTOS.input(new Blob([photo]).stream())
      .transform({ width: WIDTH, fit: 'scale-down' })
      .output({ format: 'image/jpeg', quality: 80 });
    body = await out.response().arrayBuffer();
  } catch {
    // Unshrunk is still a photo: send the original and leave it out of the cache, to try again.
    return new Response(photo, { headers });
  }
  const shrunk = new Response(body, { headers });
  locals.cfContext?.waitUntil(cache.put(key, shrunk.clone()));
  return shrunk;
};
