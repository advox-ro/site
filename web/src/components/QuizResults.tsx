import { useEffect, useState } from 'react';
import { countyByCode } from '../data/counties';
import PlaceIcon from './PlaceIcon';
import { MIN_SHOWN, aboutPeople } from '../lib/approx-count';
import { readProgress, saveProgress } from '../lib/page-progress';
import type { QuizTally } from '../lib/quiz-store';
import type { PageQuestion } from '../lib/pages';

type Scope = 'tu' | 'county' | 'ro';
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

/**
 * A page's results, laid out like its questions: one full screen each, scrolled the same way, the
 * question at the top and what people answered at the bottom, as the question was asked. The switch
 * for whose answers (you, your county, the country) stays fixed above. "Tu" shows only your own
 * answers; your pick is marked in every view. A local page (only some counties see it) has no
 * country view. Your answers are sent to the server first, once (they count from then on). Counts
 * come rounded, and a group under MIN_SHOWN gets no percentages (approx-count.ts, quiz-store.ts).
 */
export default function QuizResults({ slug, quiz, qs, answers, county, local, next }: { slug: string; quiz: string; qs: PageQuestion[]; answers: Record<string, string[] | null>; county: string | null; local: boolean; next: Next }) {
  const place = county === 'DIASPORA' ? 'Diaspora' : countyByCode(county)?.name;
  const scopes: { id: Scope; label: string }[] = [
    { id: 'tu', label: 'Tu' },
    ...(place ? [{ id: 'county' as const, label: place }] : []),
    ...(local ? [] : [{ id: 'ro' as const, label: 'România' }]),
  ];
  const [scope, setScope] = useState<Scope>(scopes[1]?.id ?? 'tu');
  const where = scope === 'county' ? `din ${place}` : 'din toată țara';
  const [loaded, setLoaded] = useState<Loaded>('loading');
  useEffect(() => {
    load(slug, quiz, county).then(setLoaded, () => setLoaded('failed'));
  }, [slug, quiz, county]);
  // How each question was answered, by your county or the country.
  const group = typeof loaded === 'object' && scope !== 'tu' ? (scope === 'ro' ? loaded.ro : loaded.county) : null;
  const tallies = group?.tallies ?? null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Whose answers: floats over the top of the questions, which scroll under it; same switch as
          the results chart's. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 px-4 sm:px-8">
        <div className="flex justify-center">
          <div role="tablist" aria-label="Arată răspunsurile" className="pointer-events-auto inline-flex border border-line bg-raised/90 backdrop-blur-sm">
            {scopes.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={scope === s.id}
                onClick={() => setScope(s.id)}
                className={`flex h-10 items-center gap-2 px-3.5 font-mono text-[11px] tracking-[0.1em] whitespace-nowrap uppercase transition-colors duration-150 ${i ? 'border-l border-line' : ''} ${
                  scope === s.id ? 'bg-fg text-bg' : 'text-dim [@media(hover:hover)]:hover:bg-fg/[0.05] [@media(hover:hover)]:hover:text-fg'
                }`}
              >
                <PlaceIcon kind={s.id === 'tu' ? 'you' : s.id} county={county} active={scope === s.id} inverted={scope === s.id} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {qs.map((q) => {
          const mine = answers[q.id];
          const counted = tallies?.[q.id] ?? null;
          // Too few answers here to show percentages: the options alone, and why.
          const tally = counted?.pct ? { n: counted.n, pct: counted.pct } : null;
          const multi = q.type === 'multi';
          return (
            <section key={q.id} className="mx-auto flex min-h-full w-full max-w-[1440px] snap-start snap-always flex-col justify-between gap-8 px-4 pt-16 pb-8 sm:px-8 lg:pb-12">
              <h1 className="max-w-[22ch] text-3xl leading-[1.15] font-semibold text-balance sm:text-4xl lg:text-[clamp(2.5rem,4vw,4.5rem)] lg:leading-[1.08] lg:tracking-[-0.01em]">
                {q.text}
              </h1>
              <div className="w-full lg:ml-auto lg:max-w-[40rem]">
                {(!mine || counted || (scope !== 'tu' && typeof loaded === 'string')) && (
                  <p className="mb-3 text-sm text-faint">
                    {!mine && 'Ai sărit peste. '}
                    {scope !== 'tu' && loaded === 'loading' && 'Se încarcă răspunsurile celorlalți…'}
                    {scope !== 'tu' && loaded === 'failed' && 'Răspunsurile celorlalți nu s-au încărcat. Reîncarcă pagina.'}
                    {scope !== 'tu' && loaded === 'unsent' && (
                      <>Răspunsurile tale n-au fost trimise. <a href="/welcome" className="underline decoration-acc-fg underline-offset-4">Alege din nou județul</a>, apoi revino aici.</>
                    )}
                    {counted && (tally
                      ? `Au răspuns ${aboutPeople(tally.n)} ${where}${multi ? ', fiecare putea alege mai multe variante' : ''}.`
                      : `Au răspuns sub ${MIN_SHOWN} de oameni ${where}, prea puțini ca să arătăm procentele.`)}
                  </p>
                )}
                {/* Laid out as the question was asked: a scale as five boxes side by side, the rest as a list. */}
                {q.type === 'scale' ? (
                  <ScaleResult q={q} mine={mine} pct={tally?.pct ?? null} />
                ) : (
                  <ul className="space-y-2">
                    {q.choices.map((c) => <OptionBar key={c.id} label={c.label} picked={!!mine?.includes(c.id)} pct={tally ? tally.pct[c.id] : null} />)}
                  </ul>
                )}
              </div>
            </section>
          );
        })}

        <section className="mx-auto flex min-h-full w-full max-w-[1440px] snap-start flex-col justify-center gap-8 px-4 py-8 sm:px-8">
          <a href={`/p/${next.slug}/quiz`} className="press group block max-w-xl border border-line bg-raised/60 p-5 hover:border-faint sm:p-6">
            <span className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">Următorul quiz</span>
            <span className="mt-2 block font-display text-3xl font-[850] uppercase">{next.title} →</span>
            <span className="mt-1 block text-dim">{next.summary}</span>
          </a>
          <a href="/" className="font-mono text-[11px] tracking-[0.18em] uppercase underline decoration-acc-fg underline-offset-4">← Înapoi</a>
        </section>
      </div>
    </div>
  );
}

/** One option as a row: its share as a bar behind the label (full for your own pick when there are no shares). */
function OptionBar({ label, picked, pct }: { label: string; picked: boolean; pct: number | null }) {
  if (pct === null && !picked) return <li className="border border-transparent px-4 py-3.5 text-base text-faint sm:text-lg lg:px-5 lg:py-4">{label}</li>;
  return (
    <li className={`relative overflow-hidden border px-4 py-3.5 text-base sm:text-lg lg:px-5 lg:py-4 ${picked ? 'border-acc-fg' : 'border-line'}`}>
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 transition-[width] duration-500 ease-out ${picked ? 'bar-mine' : 'bg-line'}`}
        style={{ width: `${pct ?? 100}%` }}
      />
      <span className="relative flex items-baseline justify-between gap-4">
        <span className={picked ? 'font-semibold' : ''}>
          {label}
          {picked && <span className="ml-2 font-mono text-[10px] tracking-[0.18em] uppercase">· tu</span>}
        </span>
        {pct !== null && <span className="font-display font-[800] tabular-nums">{pct}%</span>}
      </span>
    </li>
  );
}

/**
 * A 1–5 scale as when answering: five boxes in a row, the end labels under them, "doesn't apply"
 * apart below. Each box fills from the bottom, its height relative to the most picked value, so
 * the shape of the answers reads at a glance; the percentage is written in it.
 */
function ScaleResult({ q, mine, pct }: { q: PageQuestion; mine: string[] | null | undefined; pct: Record<string, number> | null }) {
  const real = q.choices.filter((c) => c.id !== 'na');
  const na = q.choices.find((c) => c.id === 'na');
  const top = pct ? Math.max(...real.map((c) => pct[c.id])) : 0;
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {real.map((c) => {
          const picked = !!mine?.includes(c.id);
          const fill = pct ? (pct[c.id] / top) * 100 : picked ? 100 : 0;
          return (
            <div key={c.id} className={`relative flex h-24 flex-col items-center justify-between overflow-hidden border py-2 lg:h-28 ${picked ? 'border-acc-fg' : 'border-line'} ${!pct && !picked ? 'text-faint' : ''}`}>
              <span aria-hidden className={`absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out ${picked ? 'bar-mine' : 'bg-line'}`} style={{ height: `${fill}%` }} />
              <span className="relative font-display text-2xl font-[800] lg:text-3xl">{c.id}</span>
              <span className="relative text-sm tabular-nums">
                {pct ? <span className="font-display font-[800]">{pct[c.id]}%</span> : picked ? <span className="font-mono text-[10px] tracking-[0.18em] uppercase">tu</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-4 text-sm text-dim">
        <span>{q.scale?.minLabel}</span>
        <span className="text-right">{q.scale?.maxLabel}</span>
      </div>
      {na && (
        <ul className="mt-3 border-t border-line pt-3">
          <OptionBar label={na.label} picked={!!mine?.includes('na')} pct={pct ? pct.na : null} />
        </ul>
      )}
    </div>
  );
}
