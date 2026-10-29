import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Options } from './Question';
import SetResults from './SetResults';
import { COUNTY_KEY, livesAbroad, readProgress, saveProgress, type SetProgress } from '../lib/set-progress';
import type { SetQuestion } from '../lib/sets';

type Next = { slug: string; title: string; summary: string };

const GATA_MS = 3000; // how long "Gata" stays before the result

/**
 * Answers one set as a column of full-screen questions, scrolled like the feed: the question at the
 * top, its answers at the bottom. The next question only appears once the current one is answered
 * or skipped ("Sari peste"), and the column scrolls on to it; so it could be picked from the answers
 * so far. Scrolling back shows the answers given, which can be changed. After the last question
 * comes "Gata", a pause to go back and change something, then the result: from then on the result
 * is all there is, the questions are closed. It opens where this browser left the set. local: only
 * some counties see it.
 */
export default function SetQuiz({ slug, title, questions, next, local = false }: { slug: string; title: string; questions: SetQuestion[]; next: Next; local?: boolean }) {
  const [county, setCounty] = useState<string | null>(null);
  const [qs, setQs] = useState<SetQuestion[] | null>(null);
  const [progress, setProgress] = useState<SetProgress>({ answers: {} });
  const [at, setAt] = useState(0); // the question in view; qs.length is "Gata"
  const scroller = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  // Where you live decides which questions apply (a question's `where`), known only in the browser.
  useEffect(() => {
    const abroad = livesAbroad();
    setQs(questions.filter((q) => q.where !== (abroad ? 'romania' : 'diaspora')));
    setProgress(readProgress(slug));
    try {
      setCounty(localStorage.getItem(COUNTY_KEY));
    } catch {}
  }, [slug, questions]);

  const screens = () => [...(scroller.current?.children ?? [])] as HTMLElement[];
  const goTo = (i: number, smooth = true) => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    screens()[i]?.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'start' });
  };

  // How far this browser got: the newest screen shown. A question; qs.length is "Gata", the pause
  // after the last question; qs.length + 1 the result. Sets answered before it was kept count from:
  // the first question without an answer.
  const reached = !qs ? 0 : progress.done ? qs.length + 1 : (progress.reached ?? Math.max(0, qs.findIndex((q) => !(q.id in progress.answers))));

  // Open on the newest question (a finished set shows only its result).
  useLayoutEffect(() => {
    if (!qs || opened.current) return;
    opened.current = true;
    setAt(reached);
    goTo(reached, false);
  }, [qs, reached]);

  // "Gata" stays GATA_MS, time to scroll back up and change the last answer; then the result comes
  // in and the set is done. Leaving it stops the wait; coming back starts it again.
  useEffect(() => {
    if (!qs || reached !== qs.length || at !== qs.length) return;
    const t = setTimeout(() => {
      setProgress((p) => {
        const after = { ...p, reached: qs.length + 1, done: true };
        saveProgress(slug, after);
        return after;
      });
    }, GATA_MS);
    return () => clearTimeout(t);
  }, [qs, reached, at]);

  // Which screen is in view: the last one whose top has passed the middle of the scroller (the
  // result can be taller than the screen, so not "mostly visible").
  useEffect(() => {
    const el = scroller.current;
    if (!qs || !el) return;
    let queued = false;
    const update = () => {
      queued = false;
      const middle = el.getBoundingClientRect().top + el.clientHeight / 2;
      let i = 0;
      screens().forEach((s, j) => s.getBoundingClientRect().top <= middle && (i = j));
      setAt(i);
    };
    const onScroll = () => !queued && ((queued = true), requestAnimationFrame(update));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [qs]);

  if (!qs) return <p className="px-4 py-6 font-mono text-[11px] tracking-[0.18em] text-dim uppercase sm:px-8">Se încarcă…</p>;

  const answered = qs.filter((q) => progress.answers[q.id]).length;

  /**
   * Saves p and scrolls to the next screen. Past the newest question it first adds that screen
   * ("Gata" after the last); the scroll waits for it to be on the page.
   */
  const moveOn = (i: number, p: SetProgress) => {
    const after = i >= reached ? { ...p, reached: i + 1 } : p;
    saveProgress(slug, after);
    setProgress(after);
    setTimeout(() => goTo(i + 1), 40);
  };

  // A beat to see the choice marked, then on. reached is kept as it is until then.
  const answer = (i: number, choices: string[] | null) => {
    const p = { ...progress, reached, answers: { ...progress.answers, [qs[i].id]: choices } };
    setProgress(p);
    setTimeout(() => moveOn(i, p), 220);
  };
  const skip = (i: number) => moveOn(i, progress);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 sm:px-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
          <span className="truncate">{title}</span>
          <span className="tabular-nums">{progress.done ? 'Rezultat' : at < qs.length ? `${at + 1} / ${qs.length}` : 'Gata'}</span>
          {/* Answers so far stay in this browser, so leaving loses nothing. */}
          <span className="flex justify-end">
            <a href="/" className="hover:text-fg">Închide ✕</a>
          </span>
        </div>
        <div className="mt-2 h-1 bg-line">
          <div className="h-full bg-acc-fg transition-[width] duration-300" style={{ width: `${(answered / qs.length) * 100}%` }} />
        </div>
      </div>

      {progress.done ? (
        <SetResults slug={slug} qs={qs} answers={progress.answers} county={county} local={local} next={next} />
      ) : (
      <div ref={scroller} className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {qs.slice(0, reached + 1).map((q, i) => (
          <section
            key={q.id}
            data-i={i}
            className="mx-auto flex min-h-full w-full max-w-[1440px] snap-start snap-always flex-col justify-between gap-8 px-4 pt-6 pb-8 sm:px-8 lg:pt-10 lg:pb-12"
          >
            <h1 className="max-w-[22ch] text-3xl leading-[1.15] font-semibold text-balance sm:text-4xl lg:text-[clamp(2.5rem,4vw,4.5rem)] lg:leading-[1.08] lg:tracking-[-0.01em]">
              {q.text}
            </h1>
            <div className="w-full lg:ml-auto lg:max-w-[40rem]">
              <Options q={q} selected={progress.answers[q.id]} onAnswer={(c) => answer(i, c)} onSkip={() => skip(i)} />
            </div>
          </section>
        ))}

        {reached >= qs.length && (
          <section data-i={qs.length} className="mx-auto flex min-h-full w-full max-w-[1440px] snap-start snap-always flex-col justify-center gap-8 px-4 py-8 sm:px-8 lg:py-12">
            <h1 className="font-display text-[clamp(2.5rem,8.5vw,7rem)] flex flex-col items-start gap-[0.3em] leading-[0.95] font-[850] uppercase">
              {/* One block per line, the highlight sized to its own line: inline, its background would
                  cover the line above, comma under Ț included. */}
              <span>Mulțumim.</span>
              <span className="hl inline-block leading-[0.95]">Ai spus-o.</span>
            </h1>
            <div className="max-w-md">
              {/* The wait, drawn: mounted each time "Gata" is in view, so it starts over with the timer. */}
              <div className="h-1 bg-line">{at === qs.length && <div className="countdown h-full bg-acc-fg" />}</div>
              <p className="mt-3 text-dim">Rezultatul apare imediat. Derulează în sus dacă vrei să schimbi un răspuns.</p>
            </div>
          </section>
        )}

      </div>
      )}
    </div>
  );
}
