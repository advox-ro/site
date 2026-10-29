# Seturi

The question sets shown on the home page (`/`), one after another. One file per set: `sets/<slug>.md`, front matter plus a few facts in the body. There are two kinds:

- **Sets on a part of life** take their questions from the pool in [`questions/`](../questions/README.md) and their facts from one page of [`wiki/`](../wiki/README.md).
- **Sets from the news** (with a `date`) are about something that happened in the last days. They write their own questions, take their facts from the press and lead the feed, newest first. Check them with:

```sh
node sets/validate.mjs
```

## Schema

```yaml
---
title: La medic                     # at most 32 characters; the slug is the file name
summary: Medicul de familie, …      # one sentence, at most 140 characters: what the set asks about
tags: [sănătate, servicii publice]  # 1–3, lowercase; the feed filters by them. "județ" shows as the reader's county ("Cluj")
counties: [B, IF]                   # optional: a local set, shown only there (codes from web/src/data/counties.ts, DSP for the diaspora)
order: 2                            # place in the feed
wiki: sanatate                      # the wiki page the facts come from
stat: { value: "1.055", label: "localități aveau prea puțini medici de familie la sfârșitul lui 2025" }
image:                              # optional (required with a date): the cover photo, in web/public/sets/
  src: /sets/la-doctor.jpg
  alt: Spitalul Colțea din București
  credit: Jorge Franganillo          # author, as the licence asks
  license: CC BY 2.0                 # a free licence: CC0, public domain, CC BY, CC BY-SA
  url: https://commons.wikimedia.org/wiki/File:…
  illustrative: true                 # the photo shows the subject, not the event itself
sources: [1, 3, 12]                 # numbers from that page's Surse list, for every fact below
questions: [sanatate-001, …]        # 4–8 question ids, asked in this order
---

- Two or three facts from the wiki page, one sentence or two each.
```

A set from the news adds:

```yaml
date: 2026-10-27                    # the day of the news
news:                               # the articles the facts come from: at least two outlets
  - { outlet: Digi24, title: "…", url: "https://…" }
questions:                          # its own questions, in the pool's schema (questions/README.md)
  - id: vaccinat                    # kebab-case, unique in the set; stored as <slug>-<id>
    type: single
    measures: experience
    text: Te-ai vaccinat antigripal în această toamnă?
    options:
      - { id: a, label: Da }
```

`wiki` and `sources` are optional on a news set and add background from the wiki. `stat` is optional when there is a photo.

## Rules

- **One question, one set.** No question is in two sets, so nobody answers the same question twice, and no set holds two questions of the same `group`.
- **A set is one thing from someone's life** (going to the doctor, the bills, the commute), not a whole wiki domain. It may take questions from several domains when they belong together.
- **No two sets on the same thing.** The validator flags sets whose titles and summaries share most of their words, or that use the same key figure.
- **Facts as the wiki states them.** The key figure and the body repeat the wiki page, with its numbers and dates, and every one of them is in `sources`. Good figures as well as bad ones.
- **At least 3 questions a resident can answer.** A set with fewer than 3 questions for where someone lives (a question's `where`) is hidden from them.
- **News sets: facts from at least two outlets.** Every fact in the body appears in one of the `news` articles (or the wiki sources), as they report it. When the outlets disagree, the set says what each one reports or leaves it out. When a side denies the accusations, the set says so too.
- **News sets: questions about the reader, not about the event.** What it changes for them, what they expect, whom they trust, what they would choose. Never who is to blame, never parties or politicians, and every rule in [QUIZ.md](../questions/QUIZ.md).
- **Photos with a free licence only,** from Wikimedia Commons or similar, with author and licence on the set's page. Press photos are not used. A photo that shows the subject and not the event is marked `illustrative`.
- **Local sets name their counties.** A story about some counties only (a weather warning, a closed road, a county hospital) lists them in `counties`, and only people from there see it. A set for people abroad only is `counties: [DSP]` and needs at least 3 questions they can answer. A story that matters to the whole country stays without `counties`, even if it happened in one place.
- The body follows the wiki's style: plain sentences, no slogans, no questions to the reader.
