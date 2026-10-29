import type { APIRoute } from 'astro';
import { setCounts } from '../../lib/set-store';

export const prerender = false;

// GET ?county=<code> -> { [quiz slug]: { ro, county } }: how many people finished each quiz, in the
// whole country and in the county. For the home page. Rounded, see lib/set-store.ts.
export const GET: APIRoute = async ({ url }) => {
  try {
    return Response.json(await setCounts(url.searchParams.get('county')), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({}, { status: 502 });
  }
};
