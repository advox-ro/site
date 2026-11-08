# advox

The website of advox: pages about life in Romania and about the day's news, each told as a few cards and an article, with its sources, and ending in a short anonymous quiz. After answering you see how people in your county and in the whole country answered. The pages, the wiki and the question pool are written and published by the redactor ([advox-ro/redactor](https://github.com/advox-ro/redactor)); this repository draws them and keeps the answers.

Live at [advox.ro](https://advox.ro). What advox is and why: [MANIFEST.md](MANIFEST.md), shown at [/mission](https://advox.ro/mission).

## Running it

```sh
cd web && npm install
npm run db:local # create or migrate the dev server's local database (.wrangler/state)
npm run dev      # http://localhost:4321
npm run build    # build into web/dist
```

The root `package.json` forwards `dev` and `build` to `web/`, so they also work from the repo root. The dev server reads the content from the live redactor through a remote service binding.

`npm run build` first runs `web/scripts/build-og.mjs`, which renders the social preview images for the site and the wiki index (`public/og/`) and the app icons (`public/icons/`). Each wiki page's preview is drawn on request with the same look (`web/src/pages/og/wiki/[slug].png.ts`). Both folders are generated, not committed; `npm run og` regenerates them on their own.

## Layout

| Path | What |
| --- | --- |
| `web/` | The site: Astro + React islands + Tailwind, deployed as a Cloudflare Worker |
| `web/src/lib/redactor.ts` | The content, read at request time from the redactor's Worker through the `REDACTOR` service binding: the pages and their photos, the wiki, the question pool, and a page on one of the editor's branches |
| `web/src/lib/pages.ts` | The pages as the site uses them: their questions resolved from the pool or written in the page, their sources joined with the wiki pages they cite |
| `web/src/pages/index.astro` | Home page: the pages, one per screen, with a search and topics in the header; sends you to `/welcome` until a county and age are picked. Up, Down, Space and Page Up/Down move from page to page |
| `web/src/components/PageDeck.astro`, `DeckCard.astro`, `web/src/lib/deck.ts` | A page's cards, side by side: the cover, one card per kind the redactor writes (a figure, a comparison, a line over time, a share, a ranking, a timeline, voices, a list, text), the sources and the quiz. Left and Right, the arrows and the dots move through them |
| `web/src/pages/p/[slug].astro` | A page as an article to read top to bottom, with the cards' drawings where the article places them |
| `web/src/pages/p/[slug]/quiz.astro`, `web/src/components/PageQuiz.tsx`, `QuizResults.tsx`, `Question.tsx` | A page's quiz and its results: a card per question, your answer next to your county's or the country's |
| `web/src/lib/page-progress.ts` | What this browser answered on each page, in localStorage, and the county and age it picked |
| `web/src/pages/preview/` | A page on the editor's branch, every card one under another, for the redactor to photograph before proposing it. It answers 404 without the redactor's key for that branch. Not linked, not indexed |
| `web/src/pages/wiki/`, `web/src/pages/sitemap-wiki.xml.ts` | The wiki (`/wiki`, `/wiki/<slug>`), rendered on request, and its pages' sitemap |
| `web/src/components/Hero.tsx`, `DotMap.tsx` | `/welcome`: the map, the county and age pickers. The dot map of Romania is drawn on a canvas; Diaspora is its own cluster |
| `web/src/data/counties.ts` | The 41 județe, București and Diaspora, with plate codes and NUTS3 ids |
| `web/src/data/dots.ts`, `outlines.ts` | Generated: the map's dot grid and small outlines of the country and each județ (see below) |
| `web/migrations/` | The D1 database's tables |
| `web/src/styles/global.css` | Theme tokens for light and dark, and the cards' styles |

## Answers

The Worker is stateless; [Cloudflare D1](https://developers.cloudflare.com/d1/) stores the answers. The database (`advox`) was created with `--jurisdiction=eu`, so it runs and keeps its data only in the European Union (the privacy page says so; a jurisdiction can only be set when a database is created).

- **Voters** (`lib/quiz-store.ts`, `migrations/0003_quizzes.sql`). "Începe" on `/welcome` makes the browser a voter (`POST /api/voter`, behind Turnstile and the rate limit): a row in `voters` with the county and age, its random id in an HttpOnly cookie (`voter`). `DELETE /api/voter` (from `/privacy`) deletes the voter and its answers.
- **A page's quiz.** Its answers stay in the browser until its result shows, then go to `quiz_answers` in one request (`POST /api/quiz`), one row per question, with the county and age of that moment. `GET /api/quiz` counts them per county and for the country: a quiz's answers, or without a quiz how many finished each. Counts leave the server rounded (`lib/approx-count.ts`), and a group under 20 gets no percentages.
- **Batches** (`lib/snapshots.ts`, `migrations/0006_snapshots.sql`). A group's numbers (a quiz in a county or in the whole country) are kept as computed and recomputed only once at least 10 new people answered or left it, and at most once an hour, so the difference between two looks holds at least 10 people's answers. Changing an answer or sending it again doesn't move a batch; the change comes in with the next one. Someone with 9 new voters, each behind Turnstile, could still isolate one answer.
- **Bots.** Becoming a voter needs a Cloudflare Turnstile token (`lib/turnstile-client.ts`, checked in `lib/turnstile.ts`; invisible unless Cloudflare wants a box ticked) issued on advox.ro, and is limited to 10 a minute per IP, an IPv6 one by its /64 (`SESSION_LIMIT` in `wrangler.jsonc`). IPs are never stored, and per-request logs are off. Request bodies over 16 KB are turned down.

```sh
npx wrangler d1 execute advox --remote --command "SELECT COUNT(DISTINCT voter_id) FROM quiz_answers"
```

Local secrets live in `web/.dev.vars` (`TURNSTILE_SECRET`; in dev, Turnstile's test secret `1x0000000000000000000000000000000AA`); production ones are Worker secrets (`npx wrangler secret put …`).

## Regenerating the map

`dots.ts` and `outlines.ts` are built from Eurostat's NUTS boundaries (in Romania, NUTS3 = județe):

```sh
curl -o nuts3.geojson https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_10M_2024_4326_LEVL_3.geojson
node web/scripts/build-dots.mjs nuts3.geojson
```

`web/scripts/build-outlines.mjs` takes the 1:20M country and county files; its header lists them.

Boundaries © EuroGeographics: the credit under the map on `/welcome` is required by the licence.

## Deployment

Cloudflare Worker `advox`, serving `advox.ro` and `www.advox.ro` (custom domains in `web/wrangler.jsonc`). It reads its content from the redactor's Worker (`redactor`) through the `REDACTOR` service binding, so a change there that the site needs (a new method on its `Content` entrypoint) is deployed there first.

Security headers (HSTS, a report-only Content Security Policy, no framing) come from `web/public/_headers` for the static pages and `web/src/middleware.ts` for the rest.

Every push to `main` deploys through GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): it builds, applies new D1 migrations, then deploys. **Run workflow** on the Actions tab redeploys `main` by hand. It needs two repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Wrangler's output stays out of the public log; a failure shows only its error lines, with emails and account names blanked out.

## Licence

The code is under the MIT licence ([LICENSE](LICENSE)). The map's boundaries keep the licence named above.
