// A quiz's cover photo, from the redactor, which publishes it with the quiz (lib/sets.ts).
import type { APIRoute } from 'astro';
import { photoOf } from '../../lib/sets';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const res = await photoOf(params.file ?? '');
  if (!res) return new Response('not found\n', { status: 404 });
  return new Response(res.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
};
