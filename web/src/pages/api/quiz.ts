import type { APIRoute } from 'astro';
import { COUNTIES as ALL } from '../../data/counties';
import { readJson } from '../../lib/http';
import { QuizError } from '../../lib/quiz-server';
import { allPages, questionsOf } from '../../lib/pages';
import { quizCounts, saveQuiz, quizTally, voterOf } from '../../lib/quiz-store';
import { setVoter, voterId } from '../../lib/voter-cookie';

export const prerender = false;

const COUNTIES = new Set(ALL.map((c) => c.code));
// A quiz's questions, by its id, from the page that names it (one page per quiz).
const questionsBy = async (quiz: string) => {
  const page = (await allPages()).find((p) => p.data.quiz === quiz);
  return page ? questionsOf(page) : null;
};

// GET ?quiz=<id>&county=<code> -> { ro, county }: how the quiz was answered in the whole country and
// in the county (null without one). Without a quiz, ?county=<code> -> { [quiz id]: { ro, county } }:
// how many people finished each quiz, for the home page. Rounded, see lib/quiz-store.ts.
export const GET: APIRoute = async ({ url }) => {
  if (!url.searchParams.has('quiz')) {
    try {
      return Response.json(await quizCounts(url.searchParams.get('county')), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
      console.error(e);
      return Response.json({}, { status: 502 });
    }
  }
  const qs = await questionsBy(url.searchParams.get('quiz') ?? '');
  if (!qs) return Response.json({ error: 'Quiz necunoscut.' }, { status: 404 });
  const county = url.searchParams.get('county');
  const quiz = url.searchParams.get('quiz')!;
  try {
    const [ro, here] = await Promise.all([quizTally(quiz, qs, null), county && COUNTIES.has(county) ? quizTally(quiz, qs, county) : null]);
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
    const quiz = String(body.quiz);
    const qs = await questionsBy(quiz);
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
    await saveQuiz(voter, quiz, rows);
    setVoter(cookies, url, voter.id);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof QuizError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e);
    return Response.json({ error: 'Ceva n-a mers. Încearcă din nou.' }, { status: 502 });
  }
};
