import type { APIRoute } from 'astro';
import { pageCounts } from '../../lib/page-store';

export const prerender = false;

// GET ?county=<code> -> { [page slug]: { ro, county } }: how many people finished each page, in the
// whole country and in the county. For the home page. Rounded, see lib/page-store.ts.
export const GET: APIRoute = async ({ url }) => {
  try {
    return Response.json(await pageCounts(url.searchParams.get('county')), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({}, { status: 502 });
  }
};
