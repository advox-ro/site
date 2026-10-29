// Checks the sets against the rules in sets/README.md: the schema, the question pool, the wiki,
// the news sets' press links, photos and own questions, and duplicates (a question in two sets,
// two sets on the same thing). Uses the site's YAML parser (web/node_modules).
// Usage: node sets/validate.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const site = join(root, '..');
const YAML = createRequire(join(site, 'web/package.json'))('yaml');

function frontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return m && { data: YAML.parse(m[1]), body: m[2].trim() };
}

const MEASURES = ['experience', 'satisfaction', 'priority', 'trend', 'tradeoff', 'expectation', 'trust', 'opinion'];
const FREE_LICENSE = /^(CC0|Public domain|CC BY(-SA)? \d\.\d)/;
// County codes a local set may name (web/src/data/counties.ts), and DSP for the diaspora.
const COUNTIES = new Set([...readFileSync(join(site, 'web/src/data/counties.ts'), 'utf8').matchAll(/code: '([A-Z]+)'/g)].map((m) => m[1]).filter((c) => c !== 'DIASPORA'));
const NEWS_DAYS = 14; // a news set older than this is flagged for the archive

const pool = new Map();
for (const f of readdirSync(join(site, 'questions')).filter((f) => f.endsWith('.jsonl')))
  for (const line of readFileSync(join(site, 'questions', f), 'utf8').split('\n'))
    if (line.trim()) {
      const q = JSON.parse(line);
      pool.set(q.id, q);
    }
const served = JSON.parse(readFileSync(join(site, 'web/src/data/quiz.json'), 'utf8')).questions;

function wikiSources(slug) {
  const file = join(site, 'wiki', `${slug}.md`);
  if (!existsSync(file)) return null;
  const surse = readFileSync(file, 'utf8').split(/^## Surse\s*$/m)[1] ?? '';
  return new Set([...surse.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1])));
}

const words = (s) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z]{4,}/g) ?? []);
const jaccard = (a, b) => [...a].filter((x) => b.has(x)).length / (new Set([...a, ...b]).size || 1);

let errors = 0, warnings = 0;
const err = (f, msg) => (errors++, console.log(`✗ ${f}: ${msg}`));
const warn = (f, msg) => (warnings++, console.log(`! ${f}: ${msg}`));

const sets = [];
for (const f of readdirSync(root).filter((f) => /^[a-z][a-z0-9-]*\.md$/.test(f))) {
  const parsed = frontMatter(readFileSync(join(root, f), 'utf8'));
  if (!parsed) { err(f, 'no front matter'); continue; }
  const { data: d, body } = parsed;
  sets.push({ f, slug: f.slice(0, -3), ...d, body });

  for (const k of ['title', 'summary', 'tags', 'questions']) if (d[k] === undefined) err(f, `missing ${k}`);
  const news = d.date !== undefined;
  if (!news && typeof d.order !== 'number') err(f, 'a set without a date needs an order');
  if (news && Number.isNaN(Date.parse(d.date))) err(f, `date "${d.date}" is not a date`);
  if (news && (Date.now() - Date.parse(d.date)) / 864e5 > NEWS_DAYS) warn(f, `news from ${d.date}, over ${NEWS_DAYS} days old`);
  if (d.title?.length > 32) err(f, `title over 32 characters`);
  if (d.summary?.length > 140) err(f, `summary over 140 characters (${d.summary.length})`);
  if (d.tags && (d.tags.length < 1 || d.tags.length > 3)) err(f, '1–3 tags');
  for (const t of d.tags ?? []) if (t !== t.toLowerCase()) err(f, `tag "${t}" not lowercase`);
  if (d.counties !== undefined) {
    if (!Array.isArray(d.counties) || !d.counties.length) err(f, 'counties must be a non-empty list, or absent for everyone');
    for (const c of d.counties ?? []) if (c !== 'DSP' && !COUNTIES.has(c)) err(f, `county "${c}" is not a code from counties.ts (or DSP)`);
    if (new Set(d.counties).size !== d.counties.length) err(f, 'a county listed twice');
  }
  if (!d.stat && !d.image) err(f, 'the cover needs a stat or an image');
  if (d.stat && (!d.stat.value || !d.stat.label)) err(f, 'stat needs value and label');
  if (d.stat?.value?.length > 10) err(f, `stat value "${d.stat.value}" over 10 characters`);
  if (!body) err(f, 'no body (the facts)');

  if (d.image) {
    for (const k of ['src', 'alt', 'credit', 'license', 'url']) if (!d.image[k]) err(f, `image needs ${k}`);
    if (d.image.src && !existsSync(join(site, 'web/public', d.image.src))) err(f, `no file web/public${d.image.src}`);
    if (d.image.license && !FREE_LICENSE.test(d.image.license)) err(f, `image licence "${d.image.license}" is not a free licence`);
  } else if (news) err(f, 'a news set needs an image');

  if (news) {
    const outlets = new Set((d.news ?? []).map((n) => n.outlet));
    for (const n of d.news ?? []) if (!n.outlet || !n.title || !/^https:\/\//.test(n.url ?? '')) err(f, `news item needs outlet, title and an https url`);
    if (outlets.size < 2 && !(outlets.size === 1 && d.wiki && d.sources?.length)) err(f, 'a news set needs two outlets, or one and wiki sources');
  }

  if (d.wiki) {
    const sources = wikiSources(d.wiki);
    if (!sources) err(f, `no wiki page wiki/${d.wiki}.md`);
    else for (const n of d.sources ?? []) if (!sources.has(n)) err(f, `source ${n} not in the Surse list of wiki/${d.wiki}.md`);
  } else if (!news) err(f, 'a set without a date needs a wiki page');

  const qs = d.questions ?? [];
  if (qs.length < 4 || qs.length > 8) err(f, `${qs.length} questions (4–8)`);
  const groups = new Map(), own = new Set();
  let home = 0, abroad = 0;
  for (const q of qs) {
    if (typeof q === 'object') {
      // A question written for this set: the shape and the parts of QUIZ.md a script can check.
      const at = `${f} question ${q.id ?? '?'}`;
      if (!/^[a-z0-9-]+$/.test(q.id ?? '')) err(at, 'id must be kebab-case');
      if (own.has(q.id)) err(at, 'id used twice');
      own.add(q.id);
      if (!['single', 'multi', 'scale', 'yesno'].includes(q.type)) err(at, `type ${q.type}`);
      if (!MEASURES.includes(q.measures)) err(at, `measures ${q.measures}`);
      if (!q.text) err(at, 'no text');
      if (q.text?.split(/\s+/).length > 30) err(at, 'over 30 words');
      if (['single', 'multi'].includes(q.type) && !(q.options?.length >= 2 && q.options.length <= 8)) err(at, '2–8 options');
      if (q.type === 'scale' && !(q.scale?.minLabel && q.scale?.maxLabel)) err(at, 'scale needs minLabel and maxLabel');
      const all = [q.text, q.na, ...(q.options ?? []).map((o) => o.label)].filter(Boolean).join(' ');
      if (/[şţŞŢ]/.test(all)) err(at, 'cedilla ş/ţ instead of comma-below ș/ț');
      if (/\bcam\b/i.test(all)) err(at, '"cam" in a question or option');
      if (q.outlook) {
        // As in the pool (questions/README.md): every non-na choice, each one of -1, -0.5, 0, 0.5, 1.
        const ids = q.type === 'scale' ? ['1', '2', '3', '4', '5'] : q.type === 'yesno' ? ['da', 'nu'] : (q.options ?? []).map((o) => o.id);
        if (q.type === 'multi') err(at, 'outlook on a multi-choice question');
        for (const id of ids) if (!(id in q.outlook)) err(at, `outlook misses choice ${id}`);
        for (const [id, v] of Object.entries(q.outlook)) {
          if (!ids.includes(id)) err(at, `outlook names unknown choice ${id}`);
          if (![-1, -0.5, 0, 0.5, 1].includes(v)) err(at, `outlook ${id}: ${v} (one of -1, -0.5, 0, 0.5, 1)`);
        }
      }
      if (q.where !== 'diaspora') home++;
      if (q.where !== 'romania') abroad++;
      continue;
    }
    const p = pool.get(q);
    if (!p) { err(f, `${q} not in questions/*.jsonl`); continue; }
    if (!served[q]) err(f, `${q} not in web/src/data/quiz.json (run npm run quiz:sync)`);
    if (p.group) {
      if (groups.has(p.group)) err(f, `${q} and ${groups.get(p.group)} are the same question (group ${p.group})`);
      groups.set(p.group, q);
    }
    if (p.where !== 'diaspora') home++;
    if (p.where !== 'romania') abroad++;
  }
  // Who sees the set: residents, unless it is for the diaspora only.
  const dspOnly = d.counties?.length === 1 && d.counties[0] === 'DSP';
  if (dspOnly && abroad < 3) err(f, `only ${abroad} questions for the diaspora (at least 3)`);
  if (!dspOnly && home < 3) err(f, `only ${home} questions for residents (at least 3)`);
}

// Duplicates across sets.
const owner = new Map();
for (const s of sets)
  for (const id of (s.questions ?? []).filter((q) => typeof q === 'string')) {
    if (owner.has(id)) err(s.f, `${id} is already in ${owner.get(id)}`);
    else owner.set(id, s.f);
  }
const urls = new Map();
for (const s of sets)
  for (const n of s.news ?? []) {
    if (urls.has(n.url)) err(s.f, `the article ${n.url} is already in ${urls.get(n.url)}`);
    urls.set(n.url, s.f);
  }
const orders = new Map();
for (const s of sets.filter((s) => s.order !== undefined)) {
  if (orders.has(s.order)) warn(s.f, `same order as ${orders.get(s.order)}`);
  orders.set(s.order, s.f);
}
for (let i = 0; i < sets.length; i++)
  for (let j = i + 1; j < sets.length; j++) {
    const [a, b] = [sets[i], sets[j]];
    if (a.title && b.title && jaccard(words(`${a.title} ${a.summary}`), words(`${b.title} ${b.summary}`)) >= 0.4)
      err(b.f, `reads like ${a.f} (title and summary)`);
    if (a.stat?.label && a.stat.label === b.stat?.label) err(b.f, `same key figure as ${a.f}`);
  }

console.log(`${sets.length} sets (${sets.filter((s) => s.date).length} from the news), ${owner.size} pool questions: ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
