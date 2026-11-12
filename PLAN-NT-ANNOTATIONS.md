# Plan — highlights & notes in the NT reader; Catena Aurea (deferred)

Written 2026-11-12.

**Status:** Part A (highlights and notes) is ready to build.

Part B (Catena Aurea) is parked at Gabriel's request: the source survey and the decisions taken so far are recorded here so it can be picked up later without redoing the research.

## Decisions taken (2026-11-12)

| Question | Decision |
|---|---|
| Highlight granularity | Whole verses — tap to select. Works the same in PT, LA and both interlinear modes (versification is identical). |
| Colors | Several fixed colors (5), theme-aware; no user labels. |
| Where to browse all marks | A button in the NT reader header opening an "Anotações" sheet. |
| Scope | NT reader only — not the Liturgia do Dia readings. |
| Catena Aurea | Deferred. When resumed: reachable from the verse action bar in the NT reader **and** from the Gospel in Liturgia do Dia; loaded per Gospel on first use; read-only. Language still open (see B6). |

---

## Part A — highlights and notes

### A1. Data model

Two new synced tables, one Dexie version (**v28**), sync schema **9 → 10**.

```ts
export type HighlightColor = 'amarelo' | 'verde' | 'azul' | 'rosa' | 'roxo'

export interface VerseHighlight {
  id: string                    // `${book}:${chapter}:${verse}`, e.g. 'Matt:5:3'
  book: string                  // NT book key (src/data/nt/books.ts); validated on read
  chapter: number
  verse: number
  color: HighlightColor | null  // null = cleared; the row is kept
  updatedAt: string
}

export interface VerseNote {
  id: string                    // generateId()
  book: string
  chapter: number               // first verse of the passage
  verse: number
  endChapter: number            // last verse of the passage, inclusive
  endVerse: number              //   (equal to the start for a one-verse note)
  text: string                  // plain text; "\n" separates lines
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}
```

```ts
this.version(28).stores({ verseHighlights: 'id, book', verseNotes: 'id, book' })
```

A bare new-store version: no upgrade body, no reconciliation flag (same shape as v26 `pointFavorites` and v27 `jaculatorias`).

**Why one row per highlighted verse, not one row per highlighted range:**

- The id is deterministic, so the same verse highlighted on both devices collapses into one row under the 409 union merge, exactly like `pointFavorites` (`'caminho:238'`).
- "A verse has at most one color" becomes structural; ranges would need split/trim logic whenever a new highlight overlaps an old one.
- The cost is row count: a 10-verse passage is 10 rows (~80 bytes each in the encrypted blob).

  Even 2,000 highlighted verses is ~160 KB, the same order as `dailyRecords` today.

**Why notes are ranges with random ids:** a note belongs to a passage, and two notes on the same verse are legitimate.

**Deletes never delete.**

Clearing a highlight writes `color: null`; deleting a note writes `isDeleted: true`.

Both bump `updatedAt`.

The conflict merge has no tombstones, so a really deleted row would come back from the other device's snapshot (the `pointFavorites` / `jaculatorias` rule).

**Colors are stored as semantic keys, never as hex**, so the palette can be retuned per theme without a migration.

A key this build doesn't know (written by a newer build) renders as `amarelo` rather than disappearing.

**Validate on read:** rows are synced data, so a book key or chapter this build doesn't have is skipped, not rendered (the `usePointFavorites` rule).

The note text is personal: it reaches devices only through the encrypted sync and the backup file, never the public bundle.

### A2. Sync and storage checklist

The same file set as the last two synced tables (9872033 favorites, c03c731 jaculatórias):

1. `src/types/index.ts` — `HighlightColor`, `VerseHighlight`, `VerseNote`.
2. `src/db/index.ts` — table declarations + `version(28)`; update the version ledger comment.
3. `src/sync/types.ts` — `SYNC_SCHEMA = 10`, two `SyncState.data` keys with the "missing key = older client, preserve local" comment, `SYNC_TABLES`.
4. `src/sync/applyState.ts` — `ALL_TABLES`, `snapshotLocal`, apply (preserve local when the key is missing), `hasUserData` (both tables are never seeded, so they count as user data).
5. `src/sync/merge.ts` — `mergeById(… ?? [], … ?? [], newerUpdatedAt)` for both.
6. `src/sync/mutationCapture.ts` — hooks on both tables.
7. `src/utils/backup.ts` — export and import.
8. `scripts/sync-core.mjs` — a new table-group constant, `SYNC_SCHEMA = 10`, `validateSyncState`.

Then the deploy rule from CLAUDE.md: after the schema-10 deploy, open/refresh the app on both devices before the next publish.

Memory to update afterwards: the Dexie ledger in `adding-tracked-practices` (v28, next v29) and `nt-reader`.

### A3. Reader — rendering and selection (`NovoTestamentoView`)

**Extract a memoized `NtChapter` component first, as its own no-behavior-change step.**

Verse rendering is about to grow (highlight spans, selection state, note markers), and the inline `chapters.map` is the wrong place for it.

It also fixes an existing cost: every anchor change (`setCurrent` while scrolling) re-renders the whole book today — 1,151 verses in Lucas.

Keep every attribute the scroll logic relies on unchanged: `data-c`, `data-v`, `data-chapter-head`, `data-first-verse`, `lang`, and the keyed `motion.div` without `AnimatePresence`.

Pass per-chapter slices of marks and selection whose identity only changes when that chapter's marks change (cache by a per-chapter signature), so a tap re-renders one chapter, not the book.

**Highlight rendering:**

- The verse text (not the verse number) is wrapped in `<span class="nt-hl" data-color="…">` with `box-decoration-break: clone` (+ `-webkit-` prefix), so each wrapped line gets the marker look and justified text keeps its layout.
- In the interlinear modes both lines of the verse get the span.
- Palette as CSS tokens in `index.css` (`--hl-amarelo` …), translucent, with separate values for `.dark` and `.black` — check the text contrast in all three themes.

**Selection:**

- A tap (click) on a verse toggles it in a transient selection (`Set` of `"c:v"`).

  Selected verses get a dotted underline, visibly different from any highlight.
- A click is ignored when the window selection is non-collapsed (a desktop drag-to-copy — the same guard as MeditationView b40bcbe) or when it lands on a note marker.
- While anything is selected, the footer (book arrows) is replaced by an **action bar**: the 5 color swatches, "Limpar" (only when a selected verse has a color), "Nota", and ✕.
  - The timer pill and the language toggle hide while the bar is up, so they can't cover selected text.
- A color applies to every selected verse; if all of them already have that color it clears them instead.

  The selection then closes.
- "Nota" opens the editor anchored on the first..last selected verse.
- Escape, ✕, or changing book clears the selection; changing language mode keeps it (verse-level marks are language-independent).

### A4. Notes

**Marker:** a small inline icon button after the text of the passage's **last** verse, muted color, `aria-label` with the reference.

Several notes ending on the same verse share one marker.

Tapping it opens the note sheet; tapping elsewhere on the verse selects it as usual.

**Note sheet:** modeled on `JaculatoriasSheet` (c03c731) — list / new / edit modes, `ConfirmDialog` for delete, explicit save.

- Header: the passage reference ("São Mateus 5,3–10", or "5,48–6,4" across chapters) and a collapsible quote of the verses in the current lead language.
- Save is explicit ("Salvar"); no per-keystroke writes, since every write schedules an encrypted push.
- New helper next to `formatReference` in `src/data/nt/index.ts`: `formatPassage(book, start, end)`.

### A5. "Anotações" sheet

A header icon button in the reader opens a full-screen overlay styled like `NtBookPicker` (AnimatePresence is fine there).

- Two segments: **Notas** and **Destaques**; color chips filter the Destaques.
- Search over the note text with `fold()` from `prayerSearch.ts` (accents, curly quotes).
- Canonical order: book, chapter, verse.
- Highlights are grouped into passages: consecutive verses of the same chapter with the same color form one row ("Mt 5,3–10").
- Each row: reference, color dot, a one-line verse snippet (loaded lazily with `loadNtBook`, which already caches), and the first lines of the note.
- Tapping a row closes the sheet and jumps through the existing `handlePick(book, chapter, verse)` path.

### A6. Gotchas carried over from the NT reader (see memory `nt-reader`)

- The `IntersectionObserver` observes the `[data-v]` elements captured when it is set up, and only re-subscribes on `[book, lang]`.

  A mark or selection change must therefore never remount a verse element (same element type, same key), or the anchor tracking goes blind until the next book or language change.

- Mark changes must not touch `restoreRef` or the restore layout effect; it should keep running only on `[book, lang]`.
- **Arrow keys:** the window `keydown` handler changes book on ArrowLeft/ArrowRight and today only checks `pickerOpen`.

  It must also ignore keys while any sheet is open and when the event target is an input or textarea.

  Otherwise moving the cursor in a note changes the book.

- The note marker sits inside the verse element, so the "verse that covers the top edge" anchor rule is unaffected.
- Playwright `page.clock.install()` stalls motion animations; test sheet open/close in real time.

### A7. Phases

Each phase ends with `npm run build` clean, commit, push, `gh run watch` green, and a report; wait for a go-ahead before the next.

There is no unit test runner in the repo, so behavior is verified with scripted playwright-cli runs, as in earlier features.

1. **Data and sync** (no UI).
   - Verify a real v27 → v28 upgrade (HEAD build, then the new build on the same origin) keeps existing data.
   - Verify `mergeStates` with conflicting highlights and notes resolves newest-wins per row, and that a schema-9 snapshot without the new keys preserves local rows.
   - Verify a backup round-trip.
   - **After deploy, Gabriel refreshes both devices** before phase 2 ships.
2. **`NtChapter` extraction** (no behavior change).
   - Re-verify the three scroll-anchor behaviors in all four language modes: resume lands on the saved verse, language switch re-lands on the same verse, a chapter jump reports the chapter jumped to.
3. **Selection, action bar and highlights**, plus the palette.
   - Touch emulation: a tap selects, a scroll does not; a desktop drag-select does not.
4. **Notes**: marker, sheet, arrow-key guard.
5. **Anotações sheet**.

Final check on the iPhone by Gabriel: tap-vs-scroll feel, the keyboard over the note sheet in the standalone PWA, and highlight contrast in the black theme.

### A8. Defaults I picked (say if any should change)

- Five colors: amarelo, verde, azul, rosa, roxo.
- A non-contiguous selection's note covers first..last selected verse.
- The note marker sits at the end of the passage, not at its start.
- The Anotações list is in canonical order; there is no "recent first" toggle.
- Highlights in the list group within a chapter only, never across a chapter boundary.

**Optional extras, not in the phases above:** "Copiar" in the action bar (verse text + reference to the clipboard); a reader option to hide marks for a clean read.

---

## Part B — Catena Aurea (deferred)

### B1. Decisions so far

- **Placement:** the verse action bar in the NT reader (Mt, Mc, Lc, Jo only) and a "Catena Aurea" button under the Gospel in Liturgia do Dia.
- **Delivery:** lazy per-Gospel chunks, cached on first open, offline afterwards; not precached.
- **Read-only:** no stars or notes on the excerpts.
- **Language:** open — see B6.

### B2. Source survey (2026-11-12; downloads were in a session scratchpad and are not kept)

**Recommended base: isidore.co Latin–English**, `https://isidore.co/aquinas/CA{Matthew,Mark,Luke,John}.htm`.

Four pages, one per Gospel: a table pairing, row by row, each father's excerpt in Thomas's Latin with Newman's Oxford English (1841–45, public domain; prologues and ~18 bracketed rows are Joseph Kenny OP's, status unclear).

Each lectio opens with the Gospel passage it covers, Greek and English, with verse numbers.

- **Completeness:** 12,713 of corpusthomisticum's 12,730 Latin excerpts are present; 827 sections; UTF-8, no damaged characters, no empty rows.
- **One hole:** Lc 12,49–53 is missing in both languages.

  Patch from corpusthomisticum (`clc09.html`, cap. 12 l. 13) and ecatholic2000 (`untitled-73.shtml`).
- **Size:** Latin ~4.9M characters, English ~5.4M — roughly 5× the whole NT corpus (1.83 MB) per language.
- **Markup varies by book:** Matthew and Mark mark English father names with blue spans; Luke and John use `<b>CHRYS</b>.` and `CHAPTER I` spans.
- **Continuation rows** have no attribution and inherit the previous row's father (289 of 1,728 rows in Mark).
- **Attribution:** the English is more precise than Thomas's Latin label ("Chrysostomus super Matth" = Pseudo-Chrys.; "Hieronymus" on Mark = Pseudo-Jerome).

**Verse mapping is the crux.**

Sections cover ~3–4 verses on average, so the data is per range, not per verse.

The English verse labels follow the **King James** numbering.

Against `src/data/nt/books/*.json` (Clementine) they differ in exactly five chapters:

| Chapter | English max | Vulgate max | Mapping |
|---|---|---|---|
| Mt 17 | 27 | 26 | English 17:14–15 = Vulgate 17:14 |
| Mk 4 | 41 | 40 | English 4:40–41 = Vulgate 4:40 |
| Mk 8 | 38 | 39 | English 9:1 = Vulgate 8:39 |
| Mk 9 | 50 | 49 | then everything shifts by one |
| Jn 6 | 71 | 72 | English 6:51 = Vulgate 6:51–52, then shifts by one |

Other label quirks:

- Mt 5,4/5 are in Vulgate order (meek before mourn) but carry the KJV numbers.
- Mt 6,1–4 sits under Latin "Caput 5", and Mt 15,39 opens chapter 16: key everything by the verse numbers in the Gospel text, never by the chapter/lectio labels.
- "Ver. 1." prefixes, ranges like "3-6.", half-verses "1a."/"1b." in John, an OCR "l." for "1." (Mt 17,1), Mt 27,65–66 present but unnumbered.
- The "Lectio 22" heading is missing at the Mt 6,1 boundary.

**Other sources checked:**

| Source | Verdict |
|---|---|
| corpusthomisticum.org (Latin, 1953 Marietti) | Complete, but no Gospel text and no verse numbers, and some attributions are swallowed into the italics. Use as the excerpt-count oracle and patch source. "© 2019 Fundación Tomás de Aquino — Iura omnia asservantur". |
| isidore.co English-only pages | Avoid: 11,298 curly quotes destroyed in Matthew alone; colouring find-and-replace split words ("con greg ation"). |
| ecatholic2000.com (English, one page per chapter) | Cleanest section headings and keeps the Oxford references, but OCR slips and dropped footnotes. Good cross-check. |
| CCEL | Matthew and Mark only. |
| dhspriory.org | Dead (404). |
| catenabible.com | Modern app, commentary loaded client-side, NKJV. Unusable. |
| hjg.com.ar (Spanish, one page per section, 823 sections) | Best-structured markup, mostly Vulgate numbering, cites the Fathers' works. But no translator or edition is credited (rights unknown), and the Greek is garbled (Symbol font). |
| Portuguese | Editora Ecclesiae, 4 vols (2018–21), copyrighted; translator and source language not stated. No Portuguese text is freely online. |

### B3. Build pipeline (same shape as `scripts/nt/` and the Escrivá points)

- `scripts/catena/fetch.mjs` — curl with a browser UA into a gitignored `scripts/.cache/catena/`; resumable.
- `scripts/catena/build.mjs` — produces `src/data/catena/catena-<Book>-<lang>.json` + a generated `chunks.ts` (plain `import()`, no import attribute — see the header of `src/data/nt/chunks.ts`).

```ts
interface CatenaSection {
  start: { c: number; v: number }   // Clementine versification, after the KJV remap
  end: { c: number; v: number }
  lectio: string                    // source label, for provenance, e.g. "Mt cap. 5 l. 1"
  excerpts: { father: FatherKey; label: string; text: string }[]
}
```

`FATHERS` maps each source abbreviation to a Portuguese display name ("Chrys." → São João Crisóstomo, "Pseudo-Chrys." → Pseudo-Crisóstomo, "Gloss." → Glosa, "Theophyl." → Teofilacto …).

An unknown abbreviation fails the build.

**Build gates (all fail the build):**

- Every section range exists in the NT corpus.
- Coverage: every Gospel verse falls in at least one section, apart from an explicit allowlist.
- Section starts are monotonic.
- Latin and English excerpt counts match per section.
- The excerpt count matches the corpusthomisticum oracle.
- No empty text, no replacement characters or mojibake.
- Each KJV→Clementine remap and the Lc 12,49–53 patch must apply exactly once (the Escrivá `CORRECTIONS` pattern).
- Reproduce source quirks; don't "fix" them silently.

### B4. Runtime and offline

- `loadCatenaBook(book, lang)`, lazy and cached like `loadNtBook`.
- The chunk files must be named `catena-*` so the emitted JS (`catena-Matt-<hash>.js`) can't be confused with the NT's `Matt-<hash>.js`.
- `vite.config.ts`: `globIgnores: ['**/catena-*.js']` so they stay out of the precache, plus a `runtimeCaching` CacheFirst rule for them (offline after first open).
- `maximumFileSizeToCacheInBytes` (5 MB) doesn't apply to runtime caching; one language of Matthew is ~2 MB.

### B5. UI

- **NT reader:** a "Catena Aurea" action on a Gospel verse opens a sheet with the section(s) covering it.

  Header: our own Matos Soares text of the section's range (not the source's KJV/Greek Gospel text).

  Then one block per excerpt: father (Portuguese name), source label, text.

  Previous/next section arrows.

- **Liturgia do Dia:** a button under the Gospel opens the sections covering its `referencia`.

  That needs the reference parser at runtime (today `scripts/liturgy/lib/ref-parse.mjs` is build-time only), or the section list precomputed into the liturgy chunks at build time.

  It also needs a **modern → Clementine verse map for the Gospels**; see the side finding below.

### B6. Open questions before resuming

- **Language.**

  Options: English + Latin with a toggle (recommended in the survey), English only (cleanest rights), Spanish (hjg; rights unknown), or a labelled machine translation into Portuguese (breaks the verbatim-source rule the rest of the app follows).
- **Rights posture.**

  The repo is public, and committing the Latin means redistributing a text whose site claims all rights.

  That is the same personal-use stance already taken for Matos Soares (see `nt-reader` memory), but it should be a deliberate choice.
- Keep or drop the ~18 bracketed Kenny rows.
- Show the English (more precise) attribution in both languages, or each language's own label?

---

## Side finding — Liturgia do Dia Latin is off by one verse in some Gospels

Verified 2026-11-12 by reading `src/data/liturgy/propers/*.json`.

`scripts/liturgy/lib/versification.mjs` maps modern → Clementine numbering only for a few OT books.

The Gospel chapters where the lectionary's modern numbering differs from the Clementine are not mapped, so `textoLatim` starts one verse late:

| Reading | Portuguese starts | Latin starts (should be) |
|---|---|---|
| Mc 9,2-10 (Transfiguração, Lent II B) | "Jesus tomou consigo Pedro…" | "Et vestimenta ejus…" ("Et post dies sex…") |
| Mc 9,38-40 | "João disse a Jesus…" | "Jesus autem ait: Nolite prohibere…" |
| Jo 6,52-59 | "os judeus discutiam entre si…" | "Si quis manducaverit ex hoc pane…" |
| Jo 6,60-69 | "muitos dos discípulos…" | "Hæc dixit in synagoga…" |

Mc 9,14-29, 30-37, 41-50 and Jo 6,51-58 are affected too; Mt 17,14-20 starts right but probably runs one verse long.

The fix is a Gospel entry in `BOOK_VERSE_MAPS` (Mt 17, Mc 4, Mc 8–9, Jo 6) and a propers rebuild.

That map is exactly what B5 needs, so it is worth doing first, as its own change.
