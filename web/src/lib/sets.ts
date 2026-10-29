// Quizzes (quizzes/*.md): their questions resolved from quiz.json or written in the quiz, their
// sources from the wiki page they cite.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import quiz from '../data/quiz.json';
import { countyByCode } from '../data/counties';
import type { QuestionData } from '../components/Question';

export type QuestionSet = CollectionEntry<'quizzes'>;
export type SetQuestion = QuestionData & { where?: 'romania' | 'diaspora'; outlook?: Record<string, number> };

const QUESTIONS = quiz.questions as Record<string, Omit<SetQuestion, 'id'>>;

/** News sets first, newest first; then the others in their order. */
export async function allSets() {
  return (await getCollection('quizzes')).sort(
    (a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0) || (a.data.order ?? 0) - (b.data.order ?? 0),
  );
}

// The same choices quiz-sync builds for the pool (web/scripts/quiz-sync.mjs).
type Own = Exclude<QuestionSet['data']['questions'][number], string>;
function choicesOf(q: Own) {
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
