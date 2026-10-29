// The question pool for the offline scripts (quiz-sim, quiz-e2e, ab-report, picker-policy), from the
// redactor checkout next to this repository (github.com/advox-ro/redactor), which publishes it:
// quiz.json as its build writes it (`npm run content` there) and the questions/*.jsonl it comes from.
// Also the cohorts ("<county>/<age>") the site accepts (src/data/counties.ts).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const redactor = here('../../../redactor/');

const built = `${redactor}src/generated/quiz.json`;
if (!existsSync(built)) throw new Error(`no ${built}: run npm run content in the redactor checkout next to this repository`);
/** quiz.json: axes, questions, topics. */
export const quiz = JSON.parse(readFileSync(built, 'utf8'));
/** Each question as written in questions/*.jsonl, by id. */
export const sources = Object.fromEntries(
  readdirSync(`${redactor}questions`)
    .filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => readFileSync(`${redactor}questions/${f}`, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)))
    .map((q) => [q.id, q]),
);

const AGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const counties = [...readFileSync(here('../src/data/counties.ts'), 'utf8').matchAll(/code: '([A-Z]+)'/g)].map((m) => m[1]);
/** Every "<county>/<age>" the site accepts. */
export const cohorts = counties.flatMap((c) => AGES.map((a) => `${c}/${a}`));
