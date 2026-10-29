import { countyByCode } from '../data/counties';
import { OUTLINES } from '../data/outlines';

/**
 * Whose answers: a circle for you, the county's outline (a globe for the diaspora), the country's
 * outline for Romania. Filled when it's the one shown; on an inverted (pressed, dark) button the
 * outline is accent too, so the shape reads on the dark button.
 */
export default function PlaceIcon({ kind, county, active, inverted }: { kind: 'you' | 'county' | 'ro'; county?: string | null; active: boolean; inverted?: boolean }) {
  const nuts = kind === 'ro' ? 'RO' : kind === 'county' ? countyByCode(county)?.nuts : undefined;
  const paint = active
    ? { fill: 'var(--acc)', stroke: inverted ? 'var(--on-fg-mark)' : 'var(--acc-fg)' }
    : { fill: 'none', stroke: 'currentColor' };
  return (
    <svg viewBox="-1 -1 26 26" className="size-5 shrink-0 overflow-visible" aria-hidden>
      {kind === 'you' ? (
        <circle cx={12} cy={12} r={9} {...paint} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ) : nuts && OUTLINES[nuts] ? (
        <path d={OUTLINES[nuts]} {...paint} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ) : (
        <g {...paint} strokeWidth={1.5}>
          <circle cx={12} cy={12} r={10} vectorEffect="non-scaling-stroke" />
          <ellipse cx={12} cy={12} rx={4.5} ry={10} fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M2 12h20" fill="none" vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </svg>
  );
}
