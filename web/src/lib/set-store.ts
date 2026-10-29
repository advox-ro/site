// The quizzes' answers (quizzes/*.md): Cloudflare D1 (binding DB, restricted to the EU), tables in
// migrations/0003_quizzes.sql. Counts leave the server already rounded (approx-count.ts): a group
// under MIN_SHOWN gets 0 and no percentages, so an exact small count is never sent. Server only.
import { env } from 'cloudflare:workers';
import { MIN_SHOWN, roundCount } from './approx-count';
import type { SetQuestion } from './sets';

/** How a group answered a question. n: the people who answered it (rounded, 0 under MIN_SHOWN);
 *  pct: per choice id, null under MIN_SHOWN. A multi-choice question gives each choice the share
 *  of people who picked it, so they add up to more than 100. */
export type Tally = { n: number; pct: Record<string, number> | null };
/** A quiz's answers in one group (a county, or the country). people: rounded like n. */
export type SetTally = { people: number; tallies: Record<string, Tally> };

const db = () => env.DB;
const DAY = 24 * 60 * 60 * 1000;
const today = () => Date.now() - (Date.now() % DAY);
const shown = (n: number) => (n < MIN_SHOWN ? 0 : roundCount(n));

/** A new voter's id: 32 hex characters (128 random bits). */
function newId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export type Voter = { id: string; county: string; age: string };

export async function voterOf(id: string): Promise<Voter | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  return (await db().prepare('SELECT id, county, age FROM voters WHERE id = ?').bind(id).first<Voter>()) ?? null;
}

/** The voter with this id gets the new county and age; with no such voter, a new one is made. */
export async function saveVoter(id: string, county: string, age: string): Promise<string> {
  if (await voterOf(id)) {
    await db().prepare('UPDATE voters SET county = ?, age = ? WHERE id = ?').bind(county, age, id).run();
    return id;
  }
  const fresh = newId();
  await db().prepare('INSERT INTO voters (id, county, age, created_at) VALUES (?, ?, ?, ?)').bind(fresh, county, age, today()).run();
  return fresh;
}

/** Deletes the voter and every answer it sent. */
export async function deleteVoter(id: string) {
  await db().batch([
    db().prepare('DELETE FROM quiz_answers WHERE voter_id = ?').bind(id),
    db().prepare('DELETE FROM voters WHERE id = ?').bind(id),
  ]);
}

/** A finished quiz's answers, in place of any sent before. picked null: skipped. */
export async function saveSet(v: Voter, slug: string, answers: { qid: string; picked: string[] | null }[]) {
  const insert = db().prepare('INSERT INTO quiz_answers (voter_id, quiz_slug, qid, choices, county, age, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  await db().batch([
    db().prepare('DELETE FROM quiz_answers WHERE voter_id = ? AND quiz_slug = ?').bind(v.id, slug),
    ...answers.map((a) => insert.bind(v.id, slug, a.qid, a.picked && JSON.stringify(a.picked), v.county, v.age, today())),
  ]);
}

/** Whole percentages that add up to 100 (largest remainder). */
function toPercent(counts: number[]) {
  const sum = counts.reduce((a, b) => a + b, 0);
  if (!sum) return counts.map(() => 0);
  const raw = counts.map((w) => (w / sum) * 100);
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => ({ rest: r - Math.floor(r), i })).sort((a, b) => b.rest - a.rest);
  const missing = 100 - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < missing; k++) out[order[k].i]++;
  return out;
}

/** How a quiz was answered in a county, or in the whole country (county null). */
export async function setTally(slug: string, qs: SetQuestion[], county: string | null): Promise<SetTally> {
  const where = `quiz_slug = ?${county ? ' AND county = ?' : ''}`;
  const bind = county ? [slug, county] : [slug];
  const [people, answered, picks] = await db().batch([
    db().prepare(`SELECT COUNT(DISTINCT voter_id) AS n FROM quiz_answers WHERE ${where}`).bind(...bind),
    db().prepare(`SELECT qid, COUNT(*) AS n FROM quiz_answers WHERE ${where} AND choices IS NOT NULL GROUP BY qid`).bind(...bind),
    db().prepare(`SELECT qid, j.value AS c, COUNT(*) AS n FROM quiz_answers, json_each(choices) AS j WHERE ${where} GROUP BY qid, j.value`).bind(...bind),
  ]);
  const nOf = Object.fromEntries((answered.results as { qid: string; n: number }[]).map((r) => [r.qid, r.n]));
  const picked = (qid: string, c: string) => (picks.results as { qid: string; c: string; n: number }[]).find((r) => r.qid === qid && r.c === c)?.n ?? 0;
  const tallies: Record<string, Tally> = {};
  for (const q of qs) {
    const n = nOf[q.id] ?? 0;
    if (n < MIN_SHOWN) {
      tallies[q.id] = { n: 0, pct: null };
      continue;
    }
    const counts = q.choices.map((c) => picked(q.id, c.id));
    const pct = q.type === 'multi' ? counts.map((k) => Math.round((k / n) * 100)) : toPercent(counts);
    tallies[q.id] = { n: shown(n), pct: Object.fromEntries(q.choices.map((c, i) => [c.id, pct[i]])) };
  }
  return { people: shown((people.results[0] as { n: number }).n), tallies };
}

/** How many people finished each set: in the whole country, and in a county if one is given. */
export async function setCounts(county: string | null): Promise<Record<string, { ro: number; county: number }>> {
  const [ro, here] = await db().batch([
    db().prepare('SELECT quiz_slug AS s, COUNT(DISTINCT voter_id) AS n FROM quiz_answers GROUP BY quiz_slug'),
    db().prepare('SELECT quiz_slug AS s, COUNT(DISTINCT voter_id) AS n FROM quiz_answers WHERE county = ? GROUP BY quiz_slug').bind(county ?? ''),
  ]);
  const out: Record<string, { ro: number; county: number }> = {};
  for (const r of ro.results as { s: string; n: number }[]) out[r.s] = { ro: shown(r.n), county: 0 };
  for (const r of here.results as { s: string; n: number }[]) if (out[r.s]) out[r.s].county = shown(r.n);
  return out;
}
