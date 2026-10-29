import type { APIRoute } from 'astro';
import { COUNTIES as ALL } from '../../data/counties';
import { readJson } from '../../lib/http';
import { QuizError } from '../../lib/quiz-server';
import { allSets, questionsOf } from '../../lib/sets';
import { saveSet, setTally, voterOf } from '../../lib/set-store';
import { setVoter, voterId } from '../../lib/voter-cookie';

export const prerender = false;

const COUNTIES = new Set(ALL.map((c) => c.code));
const questionsBy = async (slug: string) => {
  const set = (await allSets()).find((s) => s.id === slug);
  return set ? questionsOf(set) : null;
};

// GET ?quiz=<slug>&county=<code> -> { ro, county }: how the quiz was answered in the whole country and
// in the county (null without one). Rounded, see lib/set-store.ts.
export const GET: APIRoute = async ({ url }) => {
  const qs = await questionsBy(url.searchParams.get('quiz') ?? '');
  if (!qs) return Response.json({ error: 'Quiz necunoscut.' }, { status: 404 });
  const county = url.searchParams.get('county');
  const slug = url.searchParams.get('quiz')!;
  try {
    const [ro, here] = await Promise.all([setTally(slug, qs, null), county && COUNTIES.has(county) ? setTally(slug, qs, county) : null]);
    return Response.json({ ro, county: here }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Ceva n-a mers.' }, { status: 502 });
  }
};

// POST { quiz, answers: { [question id]: choice ids | null } } -> { ok }: a finished quiz, sent once,
// replacing what this voter sent for it before. 401 without a voter (no county picked on /welcome
// in this browser, or the cookie is gone).
export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    const voter = await voterOf(voterId(cookies));
    if (!voter) return Response.json({ error: 'Alege din nou județul.' }, { status: 401 });
    const body = await readJson(request);
    const slug = String(body.quiz);
    const qs = await questionsBy(slug);
    const answers = body.answers;
    if (!qs || !answers || typeof answers !== 'object') throw new QuizError('Răspuns invalid.');
    // Only the quiz's own questions, and only choices they have.
    const rows = qs.flatMap((q): { qid: string; picked: string[] | null }[] => {
      if (!(q.id in answers)) return [];
      const picked = (answers as Record<string, unknown>)[q.id];
      if (picked === null) return [{ qid: q.id, picked: null }];
      const ids = Array.isArray(picked) ? [...new Set(picked.map(String))] : [];
      const valid = ids.length > 0 && ids.every((c) => q.choices.some((x) => x.id === c));
      if (!valid || (q.type !== 'multi' && ids.length > 1)) throw new QuizError('Răspuns invalid.');
      return [{ qid: q.id, picked: ids }];
    });
    await saveSet(voter, slug, rows);
    setVoter(cookies, url, voter.id);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof QuizError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e);
    return Response.json({ error: 'Ceva n-a mers. Încearcă din nou.' }, { status: 502 });
  }
};
