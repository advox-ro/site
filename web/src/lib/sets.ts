// The quizzes, published by the redactor (github.com/advox-ro/redactor, quizzes/README.md there) and
// read from it at request time through the REDACTOR service binding: their questions resolved from
// quiz.json or written in the quiz, their sources from the wiki page they cite. Server only.
import { env } from 'cloudflare:workers';
import { getEntry } from 'astro:content';
import quiz from '../data/quiz.json';
import { countyByCode } from '../data/counties';
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
  outlook?: Record<string, number>; // evaluative questions: choice id -> -1..1 (questions/README.md)
  where?: 'romania' | 'diaspora';
};
/** A quiz: its front matter as the redactor's quizzes/README.md describes it, and its facts as HTML. */
export type QuestionSet = {
  id: string;
  html: string;
  data: {
    title: string;
    summary: string;
    tags: string[];
    order?: number;
    date?: Date; // news quizzes: the day of the news; they lead the feed
    counties?: string[]; // local quizzes: county codes (counties.ts), DSP for the diaspora; absent: everyone
    wiki?: string;
    stat?: { value: string; label: string };
    image?: { src: string; alt: string; credit: string; license: string; url: string; illustrative: boolean };
    sources: number[];
    news: { outlet: string; title: string; url: string }[];
    questions: (string | OwnQuestion)[];
  };
};
export type SetQuestion = QuestionData & { where?: 'romania' | 'diaspora'; outlook?: Record<string, number> };

const QUESTIONS = quiz.questions as Record<string, Omit<SetQuestion, 'id'>>;

type Published = { slug: string; data: Record<string, unknown>; html: string };
const redactor = () => env.REDACTOR as unknown as { quizzes(): Promise<Published[]>; photo(file: string): Promise<Response | null> };

// Each Worker instance keeps the list a minute: a quiz the redactor publishes shows up within one.
let cached: { at: number; list: QuestionSet[] } | null = null;
const KEEP_MS = 60_000;

/** News quizzes first, newest first; then the others in their order. */
export async function allSets(): Promise<QuestionSet[]> {
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.list;
  const list = (await redactor().quizzes()).map(({ slug, data, html }) => {
    const d = data as QuestionSet['data'] & { date?: string | Date };
    return {
      id: slug,
      html,
      data: { ...d, date: d.date ? new Date(d.date) : undefined, image: d.image && { ...d.image, illustrative: !!d.image.illustrative }, sources: d.sources ?? [], news: d.news ?? [] },
    };
  });
  list.sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0) || (a.data.order ?? 0) - (b.data.order ?? 0));
  cached = { at: Date.now(), list };
  return list;
}

/** A quiz's photo from the redactor, by its file name, or null. */
export const photoOf = (file: string) => redactor().photo(file);

// The same choices quiz-sync builds for the pool (web/scripts/quiz-sync.mjs).
function choicesOf(q: OwnQuestion) {
  const list =
    q.type === 'yesno'
      ? [{ id: 'da', label: 'Da' }, { id: 'nu', label: 'Nu' }]
      : q.type === 'scale'
        ? [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: n === 1 ? q.scale!.minLabel : n === 5 ? q.scale!.maxLabel : String(n) }))
        : q.options!;
  return q.na ? [...list, { id: 'na', label: q.na }] : list;
}

export const questionsOf = (set: QuestionSet): SetQuestion[] =>
  set.data.questions.map((q) => {
    if (typeof q !== 'string') {
      const { type, text, maxSelect, scale, where, outlook } = q;
      return { id: `${set.id}-${q.id}`, type, text, maxSelect, scale, where, outlook, choices: choicesOf(q) };
    }
    const { type, text, maxSelect, scale, choices, where, outlook } = QUESTIONS[q];
    return { id: q, type, text, maxSelect, scale, choices, where, outlook };
  });

/** The quiz's sources, from the "Surse" list of its wiki page: "n. Title — Publisher. https://…". */
export async function sourcesOf(set: QuestionSet) {
  if (!set.data.wiki) return [];
  const page = await getEntry('wiki', set.data.wiki);
  const list = page?.body?.split(/^## Surse\s*$/m)[1] ?? '';
  const byNumber = new Map(
    [...list.matchAll(/^(\d+)\. (.+)$/gm)].map(([, n, line]) => {
      const url = line.match(/https?:\/\/\S+$/)?.[0];
      return [Number(n), { text: url ? line.slice(0, -url.length).trim() : line, url }] as const;
    }),
  );
  return set.data.sources.map((n) => ({ n, ...(byNumber.get(n) ?? { text: `Sursa ${n}`, url: undefined }) }));
}

export const wikiTitle = async (set: QuestionSet) => (set.data.wiki ? ((await getEntry('wiki', set.data.wiki))?.data.title ?? set.data.wiki) : null);

const DAY = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "27 oct.", for a news quiz. */
export const dayOf = (set: QuestionSet) => (set.data.date ? DAY.format(set.data.date) : null);

/** "București, Ilfov +6", for a local set; DSP is the diaspora. */
export function localLabel(codes: string[]) {
  const names = codes.map((c) => (c === 'DSP' ? 'Diaspora' : (countyByCode(c)?.name ?? c)));
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}
