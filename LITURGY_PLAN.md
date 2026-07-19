# Liturgia do Dia — design & build plan

Daily Mass liturgy (Novus Ordo, pt-BR + Latin toggle), **fully offline**, driven by a
**perpetual Roman-calendar engine** so a finite harvested corpus replays forever.

Decisions locked (2026-07-19):
- Rite: **Novus Ordo** daily Mass.
- Content: **full propers** — 1ª leitura, salmo, 2ª leitura, evangelho, Coleta, Oferendas,
  Comunhão, antífonas.
- Languages: **pt-BR + Latin**, toggle like the prayers (`PRACTICE_TEXT_LANG_KEY`).
- Delivery: **bundled offline**, no runtime network.
- Perpetuity: **true calendar engine** (re-key a harvested corpus by liturgical identity).

---

## Verified facts (probed 2026-07-19)

**pt-BR source** — `liturgia.up.railway.app/v2/{d}-{m}-{y}` (path form; the `?dia=&mes=&ano=`
query form 404'd). Full schema:
```
{ data, liturgia, cor,
  oracoes:  { coleta, oferendas, comunhao, extras:[{titulo,texto}] },
  leituras: { primeiraLeitura:[{referencia,titulo,texto}],
              salmo:[{referencia, refrao, texto}],
              segundaLeitura:[{referencia,titulo,texto}],
              evangelho:[{referencia,titulo,texto}],
              extras:[{tipo,referencia,titulo,texto}] },
  antifonas:{ entrada, comunhao } }
```
- Readings are **arrays** (alternates / multiple celebrations). Salmo carries `refrao`.
- **Past dates work** (`25-12-2024` → "Natal … Solenidade", Branco). **Far-future 404s**
  (`12-04-2029`). Forward horizon is limited → **harvest the past** (the historical range the
  API serves covers every A/B/C, I/II, seasonal-feria and sanctoral slot). Harvest script must
  binary-search the reach-back limit.
- pt text derives from the CNBB/Paulus translation (copyrighted). Fine for a personal app;
  a concern only if published.

**Latin** — bundle the **Clementine Vulgate** (public domain, includes the deuterocanon).
JSON sources: scrollmapper/bible_databases (VulgHetzenauer), churchstudio-org/openbible,
swvincent/BibleInJson; bible-api.com `translation=clementine` for spot-checks.
- Clementine ≠ **Nova Vulgata** (the exact modern-Lectionary Latin, Vatican-copyrighted, not
  bundleable). Wording/versification differ slightly.
- **Psalm numbering offset**: Vulgate (Greek) numbers most psalms one lower than modern
  (Hebrew) references → needs a mapping table. Refrão is provided separately (good).

**App foundation already present:**
- `src/utils/liturgical.ts` — `easterSunday()`, `pentecostSunday()`, `adventStart()`
  (Butcher's computus). The engine builds on these two anchors.
- UI template: `src/components/daily/AntiphonView.tsx` — full-screen swipeable slide pager
  with the pt/la toggle on `PRACTICE_TEXT_LANG_KEY`, `MarkdownRenderer` + `.prose-prayer`.
- Static bundled content is **not** synced; only tracking rows live in Dexie. New tracked
  practice ⇒ fixed-id `ADDITIONAL_PRACTICES` spec + Dexie `version(16)` upgrade + `DailyView`
  dispatch branch + predicate (per the "adding tracked practices" runbook). Dexie is at v15.

---

## The one honest limitation: Latin propers

Vulgate gives Latin for the four **scripture readings**. The **propers** (Coleta / Oferendas /
Comunhão / antífonas) are *not scripture* — their official Novus Ordo Latin is in the copyrighted
Missale Romanum. There is no free, Novus-Ordo-matched Latin for them.

⇒ **Readings: pt + Latin toggle. Propers: pt only** (toggle hidden on those slides).
(Option for later: graft the *traditional* Latin propers from Divinum Officium — but they are
different prayers from the Novus Ordo ones, so they'd be a mismatch, not a translation.)

---

## Architecture

### A. Calendar engine — `src/utils/liturgy/calendar.ts`
`liturgicalDay(date) -> { season, week, weekday, sundayCycle: A|B|C, weekdayCycle: I|II,
celebration, rank, color, key }`
- **Temporal cycle** from Easter + Advent + Christmas anchors. Hard part: **Ordinary Time week
  numbering** (two stretches; the post-Pentecost number is counted backwards so week 34 =
  Christ the King ends before Advent).
- **Sanctoral table** — `src/data/liturgy/sanctoral.ts`: General Roman + **Brazilian national**
  calendar (~200 fixed-date entries: solemnity/feast/memorial, rank, color, key).
- **Precedence resolver** — Table of Liturgical Days: rank temporal vs sanctoral candidate,
  privileged Advent/Lent/Easter ferias, Sundays never replaced except by solemnities / feasts
  of the Lord, plus **transference** of impeded solemnities (Annunciation, St Joseph, Immaculate
  Conception on a Sunday, etc.). This is the correctness core.
- **Key** = stable liturgical identity for content lookup. Temporal e.g. `T:OT-16-Sun-B`,
  `T:Lent-3-Wed`; sanctoral e.g. `S:06-29`. Winner's key is looked up.

### B. Content store — `src/data/liturgy/propers/*.json` (keyed, not per-civil-date)
Build-time harvest → for each served civil date fetch full JSON, compute its key via the engine,
store `key -> { liturgia, cor, leituras(pt), oracoes, antifonas, refrao }`, dedup by key.
Latin attached to each reading `referencia` (see C). Chunked (by season/month) for lazy load.

### C. Reference parser + Vulgate resolver — `scripts/lib/{ref-parse,vulgate}.mjs` (build-only)
Parse Brazilian citations: pt book-abbrev → Vulgate id; `cap,verse`; ranges `-` (incl.
cross-chapter); discontinuous `.`; dual psalm `Sl 22(23)`; `cf.`; alternates. Resolve ranges
against the bundled Clementine JSON; apply the psalm-offset table. **Runs at build time only** —
the app ships resolved `textoLatim` strings; the parser never reaches the client.

### D. Runtime loader — `src/data/liturgy.ts`
`resolveLiturgyForDate(date) -> LiturgyDay | undefined` — engine computes the key, lazy-imports
the chunk, returns structured pt + Latin content. Modeled on `novena.ts`.

### E. UI — `src/components/daily/LiturgiaView.tsx` (fork of `AntiphonView.tsx`)
Swipeable slides: Antífona de entrada → 1ª leitura → Salmo (+refrão) → 2ª leitura (Sun) →
Evangelho → Coleta → Oferendas → Comunhão → Antífona da comunhão. pt/la toggle on reading
slides; header shows `liturgia` + `cor`. `MarkdownRenderer` + `.prose-prayer`.

### F. Wiring
Dexie `version(16)` + fixed-id "Liturgia do dia" spec in `ADDITIONAL_PRACTICES` + `DailyView`
dispatch branch + `isLiturgiaPractice` predicate. Tracked like the antiphons (auto-mark on open).

### G. Engine validation — `scripts/verify-calendar.mjs`
**The harvested API data is the test oracle.** For every harvested date assert
`engine(date).displayName ≈ api.liturgia` and `engine(date).color == api.cor`. Iterate the engine
to ~0 mismatches. This is what makes the "fiddly precedence" tractable — thousands of dates of
ground truth.

---

## Phases (verify + report at each gate)

- **P0 — Harvest infra.** Bundle Clementine Vulgate; build ref-parser + Vulgate resolver; harvest
  raw API data to disk (detect reach-back limit; cache so re-runs don't re-hit). Verify Latin
  resolution on samples.
- **P1 — Calendar engine.** Temporal + sanctoral + precedence. Validate against harvested
  `liturgia`/`cor` oracle; iterate to ~0 mismatch. *Highest-risk phase.*
- **P2 — Content store.** Re-key harvest → keyed propers JSON, attach reading Latin, chunk.
  Coverage report (unfilled keys).
- **P3 — Runtime + UI.** Loader + `LiturgiaView` (pt/la toggle) + wiring (Dexie v16,
  `ADDITIONAL_PRACTICES`, dispatch). `tsc`/eslint clean.
- **P4 — Polish.** Psalm-offset fixes, gap fallbacks, bundle-size (Latin dedupe/compression),
  PWA precache, tests.

## Open considerations
- **Bundle size**: full propers × pt+Latin × few-thousand keys ≈ tens of MB. Chunk + lazy-load
  current period; decide precache scope for Kindle/offline in P4.
- **Tracked vs reference**: default = tracked practice (auto-mark on open), like antiphons.
- **Coverage gaps**: a liturgical key never hit in the harvest window → graceful fallback
  ("leitura indisponível offline" / nearest match). Widen harvest to minimize.
