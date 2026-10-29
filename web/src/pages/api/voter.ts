import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import quiz from '../../data/quiz.json';
import { isHuman } from '../../lib/turnstile';
import { ipKey, readJson } from '../../lib/http';
import { QuizError } from '../../lib/quiz-server';
import { deleteVoter, saveVoter } from '../../lib/set-store';
import { VOTER_COOKIE, setVoter, voterId } from '../../lib/voter-cookie';

export const prerender = false;

const COHORTS = new Set(quiz.cohorts as string[]); // "<county>/<age>"
// A person can't pick a county and an age range this fast after the page loads.
const MIN_MS_ON_PAGE = 600;

// POST { judet, varsta, website, elapsed, human } -> { ok }: "Începe" on /welcome. Makes this
// browser a voter, or gives its voter the new county and age.
//   website  honeypot: a field people never see, so it should come back empty
//   elapsed  ms between the page loading and the click
//   human    Cloudflare Turnstile token
// At most SESSION_LIMIT a minute from one IP (an IPv6 one by its /64). The IP is only used for that
// and for Turnstile, never stored.
export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    const ip = request.headers.get('cf-connecting-ip');
    if (ip && !(await env.SESSION_LIMIT.limit({ key: ipKey(ip) })).success) {
      return Response.json({ error: 'Prea multe încercări. Mai încearcă peste un minut.' }, { status: 429 });
    }
    const { judet, varsta, website, elapsed, human } = await readJson(request);
    if (website || typeof elapsed !== 'number' || elapsed < MIN_MS_ON_PAGE) {
      return Response.json({ error: 'Ceva n-a mers. Încearcă din nou.' }, { status: 400 });
    }
    if (!COHORTS.has(`${judet}/${varsta}`)) throw new QuizError('Județ sau vârstă necunoscute.');
    // Its own status, so the page can get a new token and try once more.
    if (!(await isHuman(human, ip))) return Response.json({ error: 'Verificarea a expirat. Încearcă din nou.' }, { status: 403 });
    setVoter(cookies, url, await saveVoter(voterId(cookies), String(judet), String(varsta)));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof QuizError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e);
    return Response.json({ error: 'Ceva n-a mers. Încearcă din nou.' }, { status: 502 });
  }
};

// DELETE -> { ok }: deletes this browser's voter and every quiz answer it sent (from /privacy).
export const DELETE: APIRoute = async ({ cookies }) => {
  try {
    const id = voterId(cookies);
    if (id) await deleteVoter(id);
    cookies.delete(VOTER_COOKIE, { path: '/' });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Ceva n-a mers. Încearcă din nou.' }, { status: 502 });
  }
};
