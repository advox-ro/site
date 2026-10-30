// The photo of a page not yet merged, from its branch (pages/preview/[slug].astro).
import type { APIRoute } from 'astro';
import { draftPhoto } from '../../lib/redactor';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const res = await draftPhoto(url.searchParams.get('branch') ?? '');
  if (!res) return new Response('not found\n', { status: 404 });
  return new Response(res.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
};
