// The content, published by the redactor (github.com/advox-ro/redactor) and read from it at request
// time through the REDACTOR service binding (wrangler.jsonc): the quizzes and their photos, the wiki
// and the question pool. Server only.
import { env } from 'cloudflare:workers';

/** A quiz as the redactor publishes it: its front matter and its facts as HTML. */
export type Published = { slug: string; data: Record<string, unknown>; html: string };

export type WikiEntry = { slug: string; data: { title: string; summary: string; updated: Date; order: number } };
/** A wiki page: its HTML, its headings (for the table of contents) and its numbered sources. */
export type WikiPage = WikiEntry & {
  html: string;
  headings: { depth: number; slug: string; text: string }[];
  sources: { n: number; text: string; url?: string }[];
};

/** A question of the pool (the redactor's questions/README.md), as the quiz shows it. */
export type PoolQuestion = {
  domain: string;
  tier: 'core' | 'pool';
  type: 'single' | 'yesno' | 'scale' | 'multi';
  text: string;
  maxSelect?: number;
  scale?: { minLabel: string; maxLabel: string };
  choices: { id: string; label: string }[];
  axis: number;
  measures?: string; // experience | satisfaction | priority | trend | tradeoff | expectation | trust | opinion
  outlook?: Record<string, number>;
  profile?: boolean; // a fact about you the area's other questions build on
  group?: string; // the same question in other words: at most one per quiz
  where?: 'romania' | 'diaspora'; // who can answer it: residents only, or the diaspora only (absent: anyone)
};
/** quiz.json: the results axes, in the order D1 stores them by; the questions; the topics to pick. */
export type Pool = { axes: { id: string; label: string }[]; questions: Record<string, PoolQuestion>; topics: string[] };

type Entry<T> = Omit<T, 'data'> & { data: Omit<WikiEntry['data'], 'updated'> & { updated: string } };
type Content = {
  quizzes(): Promise<Published[]>;
  photo(file: string): Promise<Response | null>;
  wiki(): Promise<Entry<WikiEntry>[]>;
  wikiPage(slug: string): Promise<Entry<WikiPage> | null>;
  pool(): Promise<Pool>;
};
const redactor = () => env.REDACTOR as unknown as Content;

export const quizzes = () => redactor().quizzes();

/** A quiz's photo, by its file name, or null. */
export const photo = (file: string) => redactor().photo(file);

const dated = <T extends Entry<WikiEntry>>(p: T) => ({ ...p, data: { ...p.data, updated: new Date(p.data.updated) } });

/** Every wiki page, in their order. */
export const wikiPages = async (): Promise<WikiEntry[]> => (await redactor().wiki()).map(dated);

/** A wiki page, or null. */
export async function wikiPage(slug: string): Promise<WikiPage | null> {
  const p = await redactor().wikiPage(slug);
  return p && dated(p);
}

// The pool changes only when the redactor deploys: each Worker instance reads it once, and again
// when asked for a question it doesn't have (a quiz published since, with new pool questions).
let pool: Promise<Pool> | null = null;
/** The question pool; `fresh` reads it again. */
export function questionPool(fresh = false): Promise<Pool> {
  if (fresh || !pool) pool = redactor().pool().catch((e) => ((pool = null), Promise.reject(e)));
  return pool;
}
