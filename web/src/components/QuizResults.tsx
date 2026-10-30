import { useEffect, useState } from 'react';
import { countyByCode } from '../data/counties';
import PlaceIcon from './PlaceIcon';
import { MIN_SHOWN, aboutPeople } from '../lib/approx-count';
import { wireDecks } from '../lib/deck';
import { readProgress, saveProgress } from '../lib/page-progress';
import type { QuizTally, Tally } from '../lib/quiz-store';
import type { PageQuestion } from '../lib/pages';

type Scope = 'county' | 'ro';
type Next = { slug: string; title: string; summary: string };
// What came back from the server: the tallies, or why there are none.
type Loaded = { ro: QuizTally; county: QuizTally | null } | 'loading' | 'unsent' | 'failed';

/** Sends the page's answers if the server doesn't have them yet, then gets how everyone answered. */
async function load(slug: string, quiz: string, county: string | null): Promise<Loaded> {
  const p = readProgress(slug);
  if (!p.sent) {
    const res = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quiz, answers: p.answers }) });
    if (res.status === 401) return 'unsent';
    if (!res.ok) return 'failed';
    saveProgress(slug, { ...readProgress(slug), sent: true });
  }
  const res = await fetch(`/api/quiz?quiz=${encodeURIComponent(quiz)}${county ? `&county=${encodeURIComponent(county)}` : ''}`);
  return res.ok ? res.json() : 'failed';
}

/** The most picked choice of a question, with its share. */
const topOf = (q: PageQuestion, pct: Record<string, number>) => q.choices.reduce((a, c) => (pct[c.id] > pct[a.id] ? c : a), q.choices[0]);

/**
 * A page's result, as a deck of cards like the page itself (lib/deck.ts): first what it adds up to
 * (how often you answered like most people here, and who answered), then a card per question with
 * how people answered it, every answer shown, minority ones too, yours marked; then the next page.
 * The switch above chooses whose answers: your county's or the whole country's (a local page, seen
 * only in some counties, has no country view). Your answers are sent first, once. Counts come
 * rounded, and a group under MIN_SHOWN gets no percentages (approx-count.ts, quiz-store.ts).
 */
export default function QuizResults({ slug, quiz, qs, answers, county, local, next }: { slug: string; quiz: string; qs: PageQuestion[]; answers: Record<string, string[] | null>; county: string | null; local: boolean; next: Next }) {
  const place = county === 'DIASPORA' ? 'Diaspora' : countyByCode(county)?.name;
  const scopes: { id: Scope; label: string }[] = [
    ...(place ? [{ id: 'county' as const, label: place }] : []),
    ...(local && place ? [] : [{ id: 'ro' as const, label: 'România' }]),
  ];
  const [scope, setScope] = useState<Scope>(scopes[0].id);
  const where = scope === 'county' ? (county === 'DIASPORA' ? 'din diaspora' : `din ${place}`) : 'din toată țara';
  const [loaded, setLoaded] = useState<Loaded>('loading');
  useEffect(() => {
    load(slug, quiz, county).then(setLoaded, () => setLoaded('failed'));
  }, [slug, quiz, county]);
  useEffect(() => wireDecks(), []);
  const group = typeof loaded === 'object' ? (scope === 'ro' ? loaded.ro : loaded.county) : null;
  const shown = (q: PageQuestion): Tally | null => {
    const t = group?.tallies[q.id];
    return t?.pct ? t : null;
  };

  // How often you picked what most people here picked, over the questions with percentages.
  const counted = qs.filter((q) => shown(q) && answers[q.id]);
  const withMost = counted.filter((q) => answers[q.id]!.includes(topOf(q, shown(q)!.pct!).id)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {scopes.length > 1 && (
        <div className="mx-auto mt-3 flex w-full max-w-[1440px] justify-center px-4">
          <div role="tablist" aria-label="Ale cui răspunsuri" className="inline-flex rounded-full border border-line bg-raised p-1">
            {scopes.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={scope === s.id}
                onClick={() => setScope(s.id)}
                className={`flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase transition-colors duration-150 ${scope === s.id ? 'bg-fg text-bg' : 'text-dim [@media(hover:hover)]:hover:text-fg'}`}
              >
                <PlaceIcon kind={s.id} county={county} active={scope === s.id} inverted={scope === s.id} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="deck-wrap relative mx-auto mt-3 mb-4 flex min-h-0 w-full max-w-[1440px] flex-1 flex-col wide:px-8">
        <div data-deck tabIndex={0} aria-label="Rezultatul" className="deck relative flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 outline-none wide:px-0">
          {/* What it adds up to. */}
          <section className="deck-card overflow-hidden" style={{ padding: 0, border: 0 }}>
            <div className="page-cover relative flex h-full flex-col p-6">
              <div aria-hidden className="page-dots absolute inset-0" />
              <h2 className="deck-title relative">Rezultatul tău</h2>
              <div className="relative mt-auto">
                {group && counted.length ? (
                  <>
                    <p className="font-display text-[clamp(4rem,24cqw,8rem)] leading-[0.85] font-[850] tracking-[-0.02em]">
                      {withMost}<span className="text-[0.4em]"> din {counted.length}</span>
                    </p>
                    <div aria-hidden className="mt-4 flex gap-2">
                      {counted.map((q) => (
                        <span key={q.id} className={`size-4 rounded-full border-2 border-current ${answers[q.id]!.includes(topOf(q, shown(q)!.pct!).id) ? 'bg-current' : ''}`} />
                      ))}
                    </div>
                    <p className="mt-3 max-w-[24ch] text-xl leading-snug font-semibold">
                      {withMost === 1 ? 'răspuns ca al celor mai mulți' : 'răspunsuri ca ale celor mai mulți'} {where}.
                    </p>
                  </>
                ) : (
                  <p className="font-display text-[clamp(2.5rem,13cqw,4.5rem)] leading-[0.9] font-[850] uppercase">
                    {loaded === 'loading' ? 'Se adună…' : 'Ești printre primii'}
                  </p>
                )}
                <p className="mt-4 text-base">
                  {loaded === 'failed' && 'Răspunsurile celorlalți nu s-au încărcat. Reîncarcă pagina.'}
                  {loaded === 'unsent' && <>Răspunsurile tale n-au fost trimise. <a href="/welcome" className="underline underline-offset-4">Alege din nou județul</a>, apoi revino.</>}
                  {group && `Au răspuns ${aboutPeople(group.people)} ${where}.`}
                  {group && !counted.length && ` Procentele apar de la ${MIN_SHOWN} de răspunsuri.`}
                </p>
                <p className="mt-1 text-sm opacity-70">Răspund cei care vor, nu un eșantion al țării.</p>
              </div>
            </div>
          </section>

          {qs.map((q) => (
            <QuestionCard key={q.id} q={q} mine={answers[q.id] ?? null} tally={shown(q)} where={where} />
          ))}

          {/* On to the next page. */}
          <section className="deck-card">
            <h2 className="deck-title">Mai departe</h2>
            <div className="mt-auto flex flex-col">
              <p className="font-display text-[clamp(1.8rem,9cqw,2.6rem)] leading-[0.95] font-[850] uppercase">{next.title}</p>
              <p className="mt-3 text-lg text-dim">{next.summary}</p>
              <a href={`/p/${next.slug}`} className="quiz-cta quiz-cta-wide press mt-5">
                <span>Vezi pagina</span>
                <svg className="quiz-cta-arrow" viewBox="0 0 20 20" aria-hidden><path d="M3 10h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" /></svg>
              </a>
              <a href="/" className="mt-4 block text-center text-sm text-dim underline underline-offset-4 hover:text-fg">Înapoi la toate paginile</a>
            </div>
          </section>
        </div>
        <div data-deck-dots aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-1.5" />
        <button data-deck-prev className="deck-arrow left-2" aria-label="Cardul anterior">←</button>
        <button data-deck-next className="deck-arrow right-2" aria-label="Cardul următor">→</button>
      </div>
    </div>
  );
}

/**
 * One question: the question, then what it comes to for you in a line (as most people, or with how
 * many), then every answer with its share, yours marked. A scale is drawn as it was asked: five
 * columns, their height the share.
 */
function QuestionCard({ q, mine, tally, where }: { q: PageQuestion; mine: string[] | null; tally: Tally | null; where: string }) {
  const pct = tally?.pct ?? null;
  const top = pct && topOf(q, pct);
  const mineTop = !!(top && mine?.includes(top.id));
  // Your share: of a single choice, its percentage; of several, the most shared of yours.
  const yours = pct && mine ? Math.max(...mine.map((c) => pct[c] ?? 0)) : null;
  const label = (id: string) => q.choices.find((c) => c.id === id)?.label ?? id;
  return (
    <section className="deck-card">
      <h2 className="text-[clamp(1.25rem,6cqw,1.6rem)] leading-tight font-semibold text-balance">{q.text}</h2>
      <div className="mt-auto flex min-h-0 flex-col gap-4 overflow-y-auto pt-4">
        {pct ? (
          <div>
            <p className="font-display text-[clamp(2.75rem,15cqw,4.5rem)] leading-[0.9] font-[850] tracking-[-0.02em]">{mine ? `${yours}%` : `${pct[top!.id]}%`}</p>
            <p className="mt-1 text-lg leading-snug">
              {!mine
                ? <>au ales „{top!.label}”. Tu ai sărit peste.</>
                : mineTop
                  ? q.type === 'multi' ? <>au ales și ei „{label(mine.find((c) => pct[c] === yours)!)}”, cel mai des ales {where}.</> : <>au răspuns ca tine, cei mai mulți {where}.</>
                  : q.type === 'multi' ? <>au ales și ei „{label(mine.find((c) => pct[c] === yours)!)}”. Cel mai des: „{top!.label}”, {pct[top!.id]}%.</> : <>au răspuns ca tine. Cei mai mulți au ales „{top!.label}”, {pct[top!.id]}%.</>}
            </p>
          </div>
        ) : (
          <p className="text-base text-dim">{mine ? 'Răspunsul tău, marcat mai jos. Procentele apar când răspund destui.' : 'Ai sărit peste.'}</p>
        )}
        {q.type === 'scale' ? <ScaleResult q={q} mine={mine} pct={pct} /> : (
          <ul className="flex flex-col gap-2">
            {q.choices.map((c) => <OptionBar key={c.id} label={c.label} picked={!!mine?.includes(c.id)} pct={pct ? pct[c.id] : null} />)}
          </ul>
        )}
        {tally && q.type === 'multi' && <p className="text-xs text-dim">Fiecare putea alege mai multe variante.</p>}
      </div>
    </section>
  );
}

/** One answer as a rounded bar, its share filled; yours in lime, with "tu". */
function OptionBar({ label, picked, pct }: { label: string; picked: boolean; pct: number | null }) {
  return (
    <li className={`relative overflow-hidden rounded-xl px-3.5 py-2.5 text-[15px] leading-snug ${picked ? 'ring-2 ring-acc-fg ring-inset' : ''} ${pct === null && !picked ? 'text-dim' : ''}`} style={{ background: 'var(--line)' }}>
      <span aria-hidden className={`bar-grow absolute inset-y-0 left-0 transition-[width] duration-700 ease-out ${picked ? 'bar-mine' : 'bg-faint/40'}`} style={{ width: `${pct ?? (picked ? 100 : 0)}%` }} />
      <span className="relative flex items-baseline justify-between gap-3">
        <span className={picked ? 'font-semibold' : ''}>
          {label}
          {picked && <span className="ml-2 rounded-full bg-fg px-1.5 py-0.5 align-[0.1em] text-[10px] font-bold tracking-[0.1em] text-bg uppercase">tu</span>}
        </span>
        {pct !== null && <span className="shrink-0 font-display font-[850] tabular-nums">{pct}%</span>}
      </span>
    </li>
  );
}

/** A 1–5 scale as when answering: five columns, each as tall as its share of the most picked. */
function ScaleResult({ q, mine, pct }: { q: PageQuestion; mine: string[] | null; pct: Record<string, number> | null }) {
  const real = q.choices.filter((c) => c.id !== 'na');
  const na = q.choices.find((c) => c.id === 'na');
  const top = pct ? Math.max(1, ...real.map((c) => pct[c.id])) : 1;
  return (
    <div>
      <div className="grid h-36 grid-cols-5 items-end gap-2">
        {real.map((c) => {
          const picked = !!mine?.includes(c.id);
          const fill = pct ? Math.max(4, (pct[c.id] / top) * 100) : picked ? 100 : 4;
          return (
            <div key={c.id} className="flex h-full flex-col items-center justify-end gap-1">
              {pct && <span className="font-display text-sm font-[850] tabular-nums">{pct[c.id]}%</span>}
              <span aria-hidden className={`bar-rise w-full rounded-t-lg transition-[height] duration-700 ease-out ${picked ? 'bar-mine ring-2 ring-acc-fg ring-inset' : 'bg-line'}`} style={{ height: `${fill}%` }} />
              <span className={`font-display text-lg font-[850] ${picked ? '' : 'text-dim'}`}>{c.id}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between gap-4 text-xs text-dim">
        <span>{q.scale?.minLabel}</span>
        <span className="text-right">{q.scale?.maxLabel}</span>
      </div>
      {na && (
        <ul className="mt-3">
          <OptionBar label={na.label} picked={!!mine?.includes('na')} pct={pct ? pct.na : null} />
        </ul>
      )}
    </div>
  );
}
