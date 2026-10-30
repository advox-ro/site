import { countyByCode } from '../data/counties';
import { MIN_SHOWN, aboutPeople } from './approx-count';
// A set's answers, kept in this browser: { answers: { [question id]: choices }, reached: the newest
// question shown (answered or skipped questions come before it), done: reached the result, sent: the
// server has the answers (api/quiz.ts) }. A skipped question has no answer.
export const setKey = (slug: string) => `set:${slug}`;
export const COUNTY_KEY = 'judet';
export const AGE_KEY = 'varsta';
/** The tag that stands for the reader's own county: shown as its name ("Cluj"). */
export const COUNTY_TAG = 'județ';

export type SetProgress = { answers: Record<string, string[] | null>; reached?: number; done?: boolean; sent?: boolean };

export function readProgress(slug: string): SetProgress {
  try {
    const p = JSON.parse(localStorage.getItem(setKey(slug)) ?? 'null');
    if (p && typeof p.answers === 'object') return p;
  } catch {}
  return { answers: {} };
}

export function saveProgress(slug: string, p: SetProgress) {
  try {
    localStorage.setItem(setKey(slug), JSON.stringify(p));
  } catch {}
}

/** Where this browser said it lives, as sets name it: a county code, or DSP for the diaspora. */
export function region() {
  try {
    const c = localStorage.getItem(COUNTY_KEY);
    return c === 'DIASPORA' ? 'DSP' : c;
  } catch {
    return null;
  }
}

export function livesAbroad() {
  try {
    return localStorage.getItem(COUNTY_KEY) === 'DIASPORA';
  } catch {
    return false;
  }
}

/**
 * Fills in every [data-set] element on the page from this browser's progress: the number of
 * questions for where you live, the start button's label ("Răspunde", "Continuă", "Rezultat"), and
 * data-state (new | started | done) for styling and ordering. Hidden: a local set (data-counties)
 * for somewhere else, or with no county picked yet, and a set with fewer than 3 questions you can
 * answer. On a set's own page (data-page) it stays, so a shared link still opens.
 */
/** Whether this browser sees a set ([data-set] or a link with the same data-*) in the feed: not a
 *  local set for somewhere else, and at least 3 questions it can answer. */
export function seen(el: HTMLElement, abroad = livesAbroad(), here = region()): boolean {
  const ids: string[] = JSON.parse(el.dataset[abroad ? 'abroad' : 'home'] ?? '[]');
  const counties: string[] | null = el.dataset.counties ? JSON.parse(el.dataset.counties) : null;
  return !(counties && !(here && counties.includes(here))) && ids.length >= 3;
}

export function wireSets() {
  const abroad = livesAbroad();
  const here = region();
  // "județ" tags and a local set's counties read as the reader's county, once it is known.
  const name = here === 'DSP' ? 'Diaspora' : countyByCode(here)?.name;
  if (name) for (const n of document.querySelectorAll('[data-county-tag]')) n.textContent = name;
  for (const el of document.querySelectorAll<HTMLElement>('[data-set]')) {
    const slug = el.dataset.set!;
    const ids: string[] = JSON.parse(el.dataset[abroad ? 'abroad' : 'home'] ?? '[]');
    const counties: string[] | null = el.dataset.counties ? JSON.parse(el.dataset.counties) : null;
    const elsewhere = !!counties && !(here && counties.includes(here));
    if (!seen(el, abroad, here) && !('page' in el.dataset)) {
      el.hidden = true;
      continue;
    }
    if (counties && !elsewhere && name) for (const n of el.querySelectorAll('[data-local]')) n.textContent = name;
    const { answers, done: finished } = readProgress(slug);
    const done = ids.filter((id) => id in answers).length;
    const state = finished ? 'done' : done === 0 ? 'new' : 'started';
    el.dataset.state = state;
    for (const n of el.querySelectorAll('[data-count]')) n.textContent = `${ids.length} întrebări`;
    // Started: how far, in the corner. Done: a check in the middle of the cover (data-done).
    for (const n of el.querySelectorAll('[data-progress]')) {
      n.textContent = state === 'started' ? `${done} / ${ids.length}` : '';
      (n as HTMLElement).hidden = state !== 'started';
    }
    for (const n of el.querySelectorAll<HTMLElement>('[data-done]')) n.hidden = state !== 'done';
    for (const n of el.querySelectorAll('[data-start-label]')) n.textContent = { new: 'Răspunde', started: 'Continuă', done: 'Rezultat' }[state];
  }
}

/**
 * How many people finished each quiz on the page ([data-people-line]): in the whole country, or in
 * the reader's county for a local set. Shown only from MIN_SHOWN up; under it the line stays hidden.
 */
export async function showPeople() {
  let county: string | null = null;
  try {
    county = localStorage.getItem(COUNTY_KEY);
  } catch {}
  const name = county === 'DIASPORA' ? 'Diaspora' : countyByCode(county)?.name;
  let counts: Record<string, { ro: number; county: number }>;
  try {
    const res = await fetch(`/api/quizzes${county ? `?county=${encodeURIComponent(county)}` : ''}`);
    if (!res.ok) return;
    counts = await res.json();
  } catch {
    return;
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-set]')) {
    const local = !!el.dataset.counties;
    const n = local ? counts[el.dataset.set!]?.county : counts[el.dataset.set!]?.ro;
    if (!n || n < MIN_SHOWN || (local && !name)) continue;
    for (const p of el.querySelectorAll('[data-people]')) p.textContent = aboutPeople(n);
    for (const p of el.querySelectorAll('[data-people-where]')) p.textContent = local ? `din ${name}` : 'din toată țara';
    for (const p of el.querySelectorAll<HTMLElement>('[data-people-line]')) p.hidden = false;
  }
}
