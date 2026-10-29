import { useEffect, useRef, useState } from 'react';
import { countyByCode } from '../data/counties';
import { QUIZ_KEY, WHERE_KEY } from '../lib/quiz-storage';
import Question, { type QuestionData } from './Question';

type Step = { done: false; token: string; n: number; total: number; question: QuestionData } | { done: true; n: number; total: number; result: string };

async function post(path: string, body: unknown): Promise<Step> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json()) as Step & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Ceva n-a mers.');
  return data;
}

export default function Quiz() {
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [where, setWhere] = useState('');
  // "Renunță" asks once more in a dialog, so a stray tap doesn't lose the quiz.
  const leave = useRef<HTMLDialogElement>(null);
  const quit = () => {
    try {
      sessionStorage.removeItem(QUIZ_KEY);
      sessionStorage.removeItem(WHERE_KEY);
    } catch {}
    location.href = '/';
  };

  // The session is created by the start button on the landing page; this page only
  // continues it (and resumes it after a reload). Opened directly, it creates nothing.
  useEffect(() => {
    let saved: Step | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(QUIZ_KEY) ?? 'null');
      // t: an area being unlocked from the results page; otherwise the county and age.
      const { c, a, t } = JSON.parse(sessionStorage.getItem(WHERE_KEY) ?? '{}');
      const county = countyByCode(c);
      if (t) setWhere(t);
      else if (county) setWhere(`${county.code} ${a ?? ''}`);
    } catch {}
    if (saved) setStep(saved);
    else setError('Alege județul și vârsta pe prima pagină.');
  }, []);

  useEffect(() => {
    try {
      if (step && !step.done) sessionStorage.setItem(QUIZ_KEY, JSON.stringify(step));
      else if (step?.done) sessionStorage.removeItem(QUIZ_KEY);
    } catch {}
  }, [step]);

  const send = async (choices: string[] | null) => {
    if (!step || step.done || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Let the question finish leaving before the next one comes in, however fast the answer is.
      const [nextStep] = await Promise.all([post('/api/answer', { token: step.token, choices }), new Promise((r) => setTimeout(r, 200))]);
      if (nextStep.done) {
        sessionStorage.removeItem(QUIZ_KEY);
        sessionStorage.removeItem(WHERE_KEY);
        // Stay busy (the question stays gone) while the results page loads.
        location.href = `/r/${nextStep.result}`;
        return;
      }
      setStep(nextStep);
      setBusy(false);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // Fills the screen: on large screens the question sits left in big type and the answers right.
  if (error && !step)
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-4">
        <p className="text-lg lg:text-2xl">{error}</p>
        <a href="/" className="font-mono text-[11px] tracking-[0.18em] uppercase underline underline-offset-4">← Înapoi</a>
      </div>
    );

  if (!step) return <p className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">Se încarcă…</p>;

  if (step.done)
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-6">
        <p className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">{where}</p>
        <h1 className="font-display text-[clamp(2.5rem,8.5vw,7rem)] flex flex-col items-start gap-[0.3em] leading-[0.95] font-[850] uppercase">
          {/* One block per line, the highlight sized to its own line: inline, its background would
              cover the line above, comma under Ț included. */}
          <span>Mulțumim.</span>
          <span className="hl inline-block leading-[0.95]">Ai spus-o.</span>
        </h1>
        <a href="/" className="font-mono text-[11px] tracking-[0.18em] uppercase underline underline-offset-4 decoration-acc-fg">← Înapoi</a>
      </div>
    );

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-x-clip" aria-busy={busy}>
      <div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
          <span className="truncate">{where}</span>
          {/* The topic pick (step 0) isn't counted as a question: 0 / 20 on it, 20 / 20 on the last. */}
          <span className="tabular-nums">{step.n} / {step.total - 1}</span>
          <span className="flex justify-end">
            <button onClick={() => leave.current?.showModal()} className="uppercase hover:text-fg">Renunță ✕</button>
          </span>
        </div>
        <div className="mt-2 h-1 bg-line">
          <div className="h-full bg-acc-fg transition-[width] duration-300" style={{ width: `${(step.n / (step.total - 1)) * 100}%` }} />
        </div>
      </div>

      {/* One card per question: leaves to the left once answered, the next comes in from the right. */}
      <Question key={step.n} q={step.question} busy={busy} error={error} onAnswer={send} />

      <dialog
        ref={leave}
        onClick={(e) => e.target === e.currentTarget && leave.current?.close()}
        className="leave-dialog m-auto w-[min(26rem,calc(100%-2rem))] border border-line bg-raised p-6 text-fg shadow-2xl shadow-black/30 sm:p-8"
      >
        {/* Focus starts on the X, so a stray Enter doesn't quit. */}
        <button autoFocus onClick={() => leave.current?.close()} aria-label="Închide" className="absolute top-3 right-3 grid size-9 place-items-center text-dim hover:text-fg">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
        </button>
        <h2 className="font-display text-4xl leading-[0.95] font-[850] uppercase">Renunți?</h2>
        <p className="mt-3 text-dim">Răspunsurile de până acum nu intră în rezultate.</p>
        <button onClick={quit} className="press mt-6 h-12 w-full bg-acc font-display text-xl font-[800] tracking-wide text-on-acc uppercase">
          Renunță
        </button>
      </dialog>
    </div>
  );
}
