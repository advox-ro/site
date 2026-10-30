// The pages, published by the redactor (github.com/advox-ro/redactor, pages/README.md there) and
// read from it at request time (lib/redactor.ts): their questions resolved from the question pool or
// written in the page, their sources from the wiki page they cite. Server only.
import { countyByCode } from '../data/counties';
import { publishedPages, questionPool, wikiPage, wikiPages, type Pool } from './redactor';
import type { QuestionData } from '../components/Question';

type OwnQuestion = {
  id: string;
  type: 'single' | 'multi' | 'scale' | 'yesno';
  measures: string;
  text: string;
  options?: { id: string; label: string }[];
  maxSelect?: number;
  scale?: { minLabel: string; maxLabel: string };
  na?: string;
  outlook?: Record<string, number>; // evaluative questions: choice id -> -1..1 (the redactor's questions/README.md)
  where?: 'romania' | 'diaspora';
};
/** A page: its front matter as the redactor's pages/README.md describes it, and its facts as HTML. */
export type Page = {
  id: string;
  html: string;
  questions: PageQuestion[]; // resolved from data.questions

  data: {
    title: string;
    summary: string;
    tags: string[];
    order?: number;
    date?: Date; // news pages: the day of the news; they lead the feed
    counties?: string[]; // local pages: county codes (counties.ts), DSP for the diaspora; absent: everyone
    wiki?: string;
    stat?: { value: string; label: string };
    image?: { src: string; alt: string; credit: string; license: string; url: string; illustrative: boolean };
    sources: number[];
    news: { outlet: string; title: string; url: string }[];
    questions: (string | OwnQuestion)[];
  };
};
export type PageQuestion = QuestionData & { where?: 'romania' | 'diaspora'; outlook?: Record<string, number> };

// Each Worker instance keeps the list a minute: a page the redactor publishes shows up within one.
let cached: { at: number; list: Page[] } | null = null;
const KEEP_MS = 60_000;

/** News pages first, newest first; then the others in their order. */
export async function allPages(): Promise<Page[]> {
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.list;
  const published = await publishedPages();
  let pool = await questionPool();
  const named = published.flatMap((q) => (q.data.questions as Page['data']['questions']).filter((x) => typeof x === 'string'));
  if (named.some((id) => !pool.questions[id])) pool = await questionPool(true);
  const list = published.map(({ slug, data, html }) => {
    const d = data as Page['data'] & { date?: string | Date };
    return {
      id: slug,
      html,
      questions: questionsIn(slug, d.questions, pool),
      data: { ...d, date: d.date ? new Date(d.date) : undefined, image: d.image && { ...d.image, illustrative: !!d.image.illustrative }, sources: d.sources ?? [], news: d.news ?? [] },
    };
  });
  list.sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0) || (a.data.order ?? 0) - (b.data.order ?? 0));
  cached = { at: Date.now(), list };
  return list;
}

/** A page's photo from the redactor, by its file name, or null. */
export { photo as photoOf } from './redactor';

// The same choices the redactor builds for the pool (scripts/pool.mjs there).
function choicesOf(q: OwnQuestion) {
  const list =
    q.type === 'yesno'
      ? [{ id: 'da', label: 'Da' }, { id: 'nu', label: 'Nu' }]
      : q.type === 'scale'
        ? [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: n === 1 ? q.scale!.minLabel : n === 5 ? q.scale!.maxLabel : String(n) }))
        : q.options!;
  return q.na ? [...list, { id: 'na', label: q.na }] : list;
}

// A pool question the pool doesn't have is left out.
const questionsIn = (slug: string, questions: Page['data']['questions'], pool: Pool): PageQuestion[] =>
  questions.flatMap((q) => {
    if (typeof q !== 'string') {
      const { type, text, maxSelect, scale, where, outlook } = q;
      return [{ id: `${slug}-${q.id}`, type, text, maxSelect, scale, where, outlook, choices: choicesOf(q) }];
    }
    if (!pool.questions[q]) return [];
    const { type, text, maxSelect, scale, choices, where, outlook } = pool.questions[q];
    return [{ id: q, type, text, maxSelect, scale, choices, where, outlook }];
  });

export const questionsOf = (page: Page): PageQuestion[] => page.questions;

/** The page's sources, from the "Surse" list of its wiki page: "n. Title — Publisher. https://…". */
export async function sourcesOf(page: Page) {
  if (!page.data.wiki) return [];
  const byNumber = new Map(((await wikiPage(page.data.wiki))?.sources ?? []).map((s) => [s.n, s]));
  return page.data.sources.map((n) => ({ n, text: byNumber.get(n)?.text ?? `Sursa ${n}`, url: byNumber.get(n)?.url }));
}

export const wikiTitle = async (page: Page) => (page.data.wiki ? ((await wikiPages()).find((p) => p.slug === page.data.wiki)?.data.title ?? page.data.wiki) : null);

const DAY = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "27 oct.", for a news page. */
export const dayOf = (page: Page) => (page.data.date ? DAY.format(page.data.date) : null);

/** "București, Ilfov +6", for a local page; DSP is the diaspora. */
export function localLabel(codes: string[]) {
  const names = codes.map((c) => (c === 'DSP' ? 'Diaspora' : (countyByCode(c)?.name ?? c)));
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}
