// How many people answered, as the site shows it: rounded, and never below a minimum. An exact
// count of a small group (one county, one question) could help pick someone out, so groups under
// MIN_SHOWN get no percentages at all, and the rest get a round number.

/** The fewest answers a group needs before its percentages are shown. */
export const MIN_SHOWN = 20;

/** 20–99 to the nearest 10, 100–999 to the nearest 50, 1.000 and up to the nearest 100. */
export function roundCount(n: number) {
  const step = n < 100 ? 10 : n < 1000 ? 50 : 100;
  return Math.max(MIN_SHOWN, Math.round(n / step) * step);
}

/** "circa 60 de oameni", "sub 20 de oameni" (Romanian puts "de" after numbers from 20 up). */
export function aboutPeople(n: number) {
  if (n < MIN_SHOWN) return `sub ${MIN_SHOWN} de oameni`;
  return `circa ${roundCount(n).toLocaleString('ro-RO')} de oameni`;
}
