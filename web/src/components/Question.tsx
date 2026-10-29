import { useState } from 'react';

export type QuestionData = {
  id: string;
  type: 'single' | 'yesno' | 'scale' | 'multi';
  text: string;
  maxSelect?: number;
  minSelect?: number; // the topic pick: exactly this many, and no skipping
  scale?: { minLabel: string; maxLabel: string };
  choices: { id: string; label: string }[];
};

const optionClass = (on: boolean) =>
  `press w-full border px-4 py-3.5 text-left text-base transition-colors sm:text-lg lg:px-5 lg:py-4 ${
    on ? 'border-fg bg-fg text-bg' : 'border-line bg-raised/60 hover:border-faint'
  }`;

/**
 * One question: the text left in big type on large screens, the answers right. Leaves to the left
 * once answered (busy), the next comes in from the right; give each question its own key.
 * onAnswer gets the picked choice ids, ['na'] for "doesn't apply", or null for a skip.
 */
export default function Question({ q, busy, error, onAnswer }: { q: QuestionData; busy: boolean; error?: string | null; onAnswer: (choices: string[] | null) => void }) {
  return (
    <div className={`q-card ${busy ? 'q-leave' : ''} grid flex-1 content-start gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:content-center lg:items-center lg:gap-20 lg:pb-[6vh]`}>
      <h1 className="text-2xl leading-snug font-semibold text-balance sm:text-3xl lg:text-[clamp(2.25rem,3.4vw,4rem)] lg:leading-[1.1] lg:tracking-[-0.01em]">
        {q.text}
      </h1>
      <Options q={q} busy={busy} error={error} onAnswer={onAnswer} />
    </div>
  );
}

/**
 * A question's answers: five boxes for a scale, a list otherwise (multi: pick, then "Continuă"),
 * and under them "doesn't apply" and "Sari peste". selected marks an answer given before (it can
 * be changed). onSkip: what "Sari peste" does; without it, a skip is onAnswer(null).
 */
export function Options({ q, busy = false, error, selected, onAnswer, onSkip }: {
  q: QuestionData;
  busy?: boolean;
  error?: string | null;
  selected?: string[] | null;
  onAnswer: (choices: string[] | null) => void;
  onSkip?: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected ?? []);
  const na = q.choices.find((c) => c.id === 'na');
  const real = q.choices.filter((c) => c.id !== 'na');
  const multi = q.type === 'multi';
  const max = q.maxSelect ?? real.length;
  const min = q.minSelect ?? 1;
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < max ? [...p, id] : p));
  const isOn = (id: string) => (multi ? picked : (selected ?? [])).includes(id);

  return (
    <div className="flex flex-col gap-6">
      {q.type === 'scale' ? (
        <div>
          <div className="grid grid-cols-5 gap-2">
            {real.map((c) => (
              <button
                key={c.id}
                disabled={busy}
                onClick={() => onAnswer([c.id])}
                className={`press h-14 border font-display text-2xl font-[800] lg:h-24 lg:text-5xl ${isOn(c.id) ? 'border-fg bg-fg text-bg' : 'border-line bg-raised/60 hover:border-faint'}`}
              >
                {c.id}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-4 text-sm text-dim lg:text-base">
            <span>{q.scale?.minLabel}</span>
            <span className="text-right">{q.scale?.maxLabel}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {multi && <p className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">{min === max ? `Alege ${max} · ${picked.length} / ${max}` : `Alege cel mult ${max}`}</p>}
          {real.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              onClick={() => (multi ? toggle(c.id) : onAnswer([c.id]))}
              className={optionClass(isOn(c.id))}
            >
              {c.label}
            </button>
          ))}
          {multi && (
            <button
              disabled={busy || picked.length < min}
              onClick={() => onAnswer(picked)}
              className="press mt-2 h-14 bg-acc font-display text-2xl font-[800] tracking-wide text-on-acc uppercase disabled:opacity-40"
            >
              Continuă →
            </button>
          )}
        </div>
      )}

      {!q.minSelect && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {na ? (
          <button disabled={busy} onClick={() => onAnswer(['na'])} className={`text-left underline-offset-4 hover:text-fg hover:underline ${isOn('na') ? 'font-semibold text-fg underline' : 'text-dim'}`}>
            {na.label}
          </button>
        ) : <span />}
        <button disabled={busy} onClick={() => (onSkip ? onSkip() : onAnswer(null))} className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase hover:text-fg">
          Sari peste {onSkip ? '↓' : '→'}
        </button>
      </div>}

      {error && <p className="text-sm text-acc-fg">{error}</p>}
    </div>
  );
}
