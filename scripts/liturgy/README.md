# Liturgy build-time scripts

**BUILD-TIME ONLY.** Nothing under `scripts/liturgy/` is imported by the app.
It exists to attach Clementine-Vulgate Latin to Brazilian lectionary
citations (the `referencia` fields from `liturgia.up.railway.app`) ahead of
time, so the shipped bundle contains plain resolved strings.

## Files

- `fetch-vulgate.mjs` — downloads the raw Vulgate JSON into `.cache/vulgate/`.
- `lib/books.mjs` — book-id tables (raw-name → OSIS id, pt-abbrev → OSIS id).
- `lib/vulgate.mjs` — normalizes + loads the Vulgate; `loadVulgate()`,
  `getVerses()`, `hasBook()`, `hasChapter()`, `lastVerse()`.
- `lib/psalm-map.mjs` — Hebrew↔Vulgate psalm-chapter offset table +
  `resolvePsalmRef()`.
- `lib/versification.mjs` — per-book Hebrew↔Vulgate chapter/verse maps for
  Zechariah, Joel, and Malachi (the three non-psalm books whose chapter
  splits differ between the two traditions), plus the modern↔Clementine
  verse maps for Matthew 17, Mark 4 and 9, John 6 and Acts 7.
- `lib/ref-parse.mjs` — parses a `referencia` string into
  `[{bookId, chapter, verses:[{from,to}]}]` segments. Never throws.
- `lib/resolve-latin.mjs` — `resolveLatin(referencia)` → `{latin, segments,
  warnings}`, on top of the parser + Vulgate + psalm map + versification map
  + Esther concordance.
- `test-vulgate.mjs` — battery test; uses every unique `referencia` found in
  `.cache/api/*.json` if present, else a small fallback list.
- `.cache/` — gitignored. `vulgate/VulgClementine.raw.json` (source download),
  `vulgate/normalized.json` (built lookup), `api/*.json` (harvested lectionary
  days, produced by the harvest half of P0 — not by these scripts).

## Source: Clementine Vulgate

**Chosen: `scrollmapper/bible_databases`, `formats/json/VulgClementine.json`**
(https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/VulgClementine.json).

That repo ships five Vulgate editions (`Vulgate`, `VulgClementine`,
`VulgConte`, `VulgHetzenauer`, `VulgSistine`) — `VulgClementine` was picked
because "Clementine" is the specific 1592 edition the plan calls for (the
historical standard Vulgate, distinct from the Nova Vulgata).

**Deuterocanon verification** — downloaded and inspected directly (not
assumed from the repo's README): the raw file has 78 books; after dropping
four non-lectionary extras (Prayer of Manasses, I/II Esdras, "Additional
Psalm", Laodiceans — apocryphal/duplicate content with no place in the Roman
lectionary and no pt abbreviation to map from), **73 books normalize
cleanly**, including all of Tobit, Judith, Wisdom, Sirach, Baruch, 1–2
Maccabees. Daniel has 14 chapters (the extra two are the Greek additions —
Susanna ch.13, Bel and the Dragon ch.14 — confirmed by reading their opening
verses). Esther has 16 chapters (Hebrew Esther has 10; the extra six,
11–16, are the Greek "Additions" — see below).

`bible-api.com?translation=clementine` was checked as an alternative/spot-
check source (`GET https://bible-api.com/data/clementine` lists its books):
it does **not** carry the deuterocanon at all (no Tob/Jdt/Wis/Sir/Bar/Macc in
its book list), confirming it's spot-check-only, per the brief, and
scrollmapper is the right primary source.

**Normalized totals**: 73 books, 1,334 chapters, 35,817 verses. Build with
`node scripts/liturgy/fetch-vulgate.mjs` then anything that calls
`loadVulgate()` (it builds `.cache/vulgate/normalized.json` on first use if
missing).

## Psalm numbering — empirical finding

The plan flagged this as the critical unknown: does the API's `Sl N(M)`
format put the Vulgate (Greek/Septuagint) number or the modern (Hebrew)
number first?

**Finding: the number *before* the parenthesis is already the Vulgate
number.** The parenthetical, when present, is the modern Hebrew number.

Verified by comparing the API's actual salmo `texto` against the Clementine
Vulgate's Latin incipit, for three real harvested dates:

| referencia | API salmo texto (opening) | Vulgate chapter matched |
|---|---|---|
| `Sl 97(98)` (25-12-2024) | "Cantai ao Senhor Deus um canto novo, porque ele fez prodígios!" | **Vulgate Ps 97**:1 "Cantate Domino canticum novum, quia mirabilia fecit." — exact match |
| `Sl 66` (01-01-2025) | "Que Deus nos dê a sua graça e sua bênção... Que na terra se conheça o seu caminho" | **Vulgate Ps 66**:2-3 "Deus misereatur nostri, et benedicat nobis... ut cognoscamus in terra viam tuam" — exact match |
| `Sl 24` (21-01-2024) | "Mostrai-me, ó Senhor, vossos caminhos, e fazei-me conhecer a vossa estrada!" | **Vulgate Ps 24**:4 "Vias tuas, Domine, demonstra mihi, et semitas tuas edoce me." — exact match |

In all three, the pre-parenthesis number is the one whose Vulgate content
matches; the number that would be "one higher" under the standard
Hebrew=Vulgate+1 offset (for chapters 11–113) is the parenthetical one, if
given, or omitted entirely (as in the `Sl 66`/`Sl 24` cases — the API doesn't
always bother with the parenthetical).

Also discovered: **the API's salmo `referencia` never carries verse numbers**
across the ~1,900 unique citations harvested (always `Sl N` or `Sl N(M)`,
verse ranges only appear on non-Psalm books). So `resolveLatin` returns the
**whole Vulgate psalm chapter** for any `Sl` reference — there's no verse
subset to select from the citation itself.

`lib/psalm-map.mjs` implements the full Hebrew↔Vulgate offset table from the
brief (including the two split/merge cases: Heb 9+10→Vulg 9, Heb 116→Vulg
114+115, Heb 147→Vulg 146+147, Vulg 9→Heb 9+10, Vulg 113→Heb 114+115) and
uses it defensively: `resolvePsalmRef` cross-checks a given parenthetical
against the table and emits a `psalm-offset-mismatch` warning if they
disagree (this fired twice across the full harvest, for `Sl 98(97)` and
`Sl 106(10)7` — both look like source-data typos: an order-flip and a
mid-number stray `)`, respectively. Both still resolved correctly, since the
pre-parenthesis number — the one that matters — parsed fine in both cases).

**Tolerant alternate form**: one citation in the corpus, `Sl (71/70)`, uses
`(A/B)` — the whole pair inside parens, slash-separated, with the **Vulgate**
number *second* (the reverse of the usual `N(M)` order). Confirmed against
the actual Vulgate text: its texto ("Não me deixeis quando chegar minha
velhice") is Vulgate Ps 70 ("Ne projicias me in tempore senectutis"), not Ps
71. `resolvePsalmRef` special-cases this exact shape.

## Esther Greek Additions — verified concordance

Modern lectionaries cite Esther's six deuterocanonical "Additions" as
lettered sub-verses inserted into the Hebrew narrative (e.g. addition C =
`Est 4,17a`–`4,17z`). Jerome instead moved **all six** additions to the end
of the book, out of narrative order, as Vulgate chapters 10:4–16:24. There's
no verse-for-verse correspondence table published anywhere authoritative
enough to trust from memory, so this was built by **reading the downloaded
Vulgate text directly** and matching content:

| Modern anchor | Vulgate location | Confirmed by reading |
|---|---|---|
| before 1,1 (Addition A, Mordecai's dream) | Esth 11,2–12,6 | ch.11 v.2 "vidit somnium Mardochæus" |
| after 3,13 (Addition B, first decree) | Esth 13,1-7 | ch.13 v.1 "Rex maximus Artaxerxes..." |
| after 4,17 (Addition C, prayers) | Esth 13,8-18 + 14,1-19 | ch.13 v.8 "Mardochæus autem deprecatus est Dominum"; ch.14 v.1 "Esther quoque regina confugit ad Dominum" |
| replacing 5,1-2 (Addition D, before the king) | Esth 15,1-19 | ch.15 v.1 "ut ingrederetur ad regem" |
| after 8,12 (Addition E, second decree) | Esth 16,1-24 | ch.16 v.1 "Rex magnus Artaxerxes..." (second royal letter) |
| after 10,3 (Addition F, dream interpretation) | Esth 10,4-13 | ch.10 vv.4+ (dream-interpretation content following the canonical vv.1-3) |

Implemented in `lib/resolve-latin.mjs` as `ESTHER_GREEK_ADDITIONS`, keyed by
the modern chapter the addition anchors to. **Chapter-block granularity
only** — the individual lettered sub-verses (17a vs 17f, etc.) are not
resolved to individual Vulgate verses; a citation like `Est 4,17` returns the
*entire* addition-C block (13,8-18 + 14,1-19) with a warning flagging the
approximation.

## Versification — Zechariah, Joel, Malachi

Three non-psalm OT books also have Hebrew/Vulgate **chapter** splits (not
just the uniform book-wide offset the Psalms have — each of these is a
one-off structural difference in one part of the book). Found because they
were exactly the citations the parser initially couldn't resolve; verified
the same way as the psalm-direction finding — take the real API date's pt
`texto` (which carries inline modern verse numbers, e.g. `"14Rejubila..."`),
match it word-for-word against Vulgate content:

**Zechariah** — `Zc 2,14-17`'s texto ("Rejubila, alegra-te, cidade de
Sião... eis que venho para habitar no meio de ti") = Vulgate **Zech 2:10**
("Lauda et lætare, filia Sion... habitabo in medio tui") — exact match, and
2:11-13 confirmed the same way for vv15-17. A second real citation,
`Zc 2,5-9`, confirmed the offset holds down to the chapter's start (modern
2:9 "Eu serei... muralha de fogo" = Vulgate 2:5 "ego ero... murus ignis").
So **modern Zc 2,5-17 = Vulgate Zech 2,1-13** (offset −4). The modern
2,1-4/Vulgate 1,18-21 boundary (the "four horns" vision) is inferred from
Vulgate content — read directly, it's exactly 4 verses long and universally
numbered ch.2 vv.1-4 in every modern Bible — not confirmed via an API
citation, since none in the corpus touches it. Chapters 3-14 unaffected.

*This one mattered beyond the failing ref*: `Zc 2,5-9.14-15` was already
"passing" (non-empty) before this fix, but **silently wrong** — it was
returning Vulgate 2:5-9 verbatim (content that's actually modern 2:9-13),
not the correct modern-2:5-9 = Vulgate-2:1-5. Confirms the team lead's
instinct that non-empty ≠ correct.

**Joel** — `Jl 4,12-21`'s texto ("rumo ao vale de Josafá... julgar todas as
nações") = Vulgate **Joel 3:12** ("in vallem Josaphat... judicem omnes
gentes") — exact match, same verse numbers. So **modern ch.4 = Vulgate
ch.3**, unshifted. Two more real citations (`Jl 1,13-15;2,1-2` and
`Jl 2,12-18`) confirmed modern ch.1 and ch.2 vv.1-18 are *already* identical
to Vulgate numbering — no offset there at all. Modern ch.2 vv.19-27 and all
of ch.3 (the 5-verse "I will pour out my spirit" chapter, mapped to Vulgate
2,28-32) are inferred from an exact verse-count fit and content universally
recognized as that passage — no citation in the corpus touches them, so this
part is unconfirmed against real API data.

**Malachi** — `Ml 3,19-20`'s texto ("Eis que virá o dia, abrasador como
fornalha") = Vulgate **Mal 4:1** ("Ecce enim dies veniet succensa quasi
caminus") — exact match. So **modern 3,19-24 = Vulgate 4,1-6** (verse −18,
chapter +1). Confirmed all the way through v.24 via a second real citation,
`Ml 3,1-4.23-24` ("Eis que eu vos enviarei o profeta Elias" = Vulgate 4:5
"Ecce ego mittam vobis Eliam prophetam" — exact match). `Ml 3,13-20`
confirmed the boundary itself: its 13-18 portion matches Vulgate 3,13-18
directly (no shift), consistent with Vulgate ch.3 having exactly 18 verses.

Implemented in `lib/versification.mjs`, wired into `resolve-latin.mjs`:
verse ranges are expanded verse-by-verse through the map and re-grouped into
Vulgate chapter runs, so a range straddling the boundary (`Ml 3,13-20`)
correctly splits into two Vulgate chapters.

## Versification — New Testament (added 2026-11-12)

Until this was added, the Latin of every Mc 9 Gospel and of several Mt 17, Jo 6 and At 7 readings was one verse off: `Mc 9,2-10` (the Transfiguration) opened on "Et vestimenta ejus", its second verse.

Non-empty Latin hid it, exactly like the Zechariah case above.

The NT differences are verse divisions, not chapter splits: in a few chapters the Clementine Vulgate joins two modern verses into one, or splits one in two, and the rest of the chapter shifts by one.

**How they were found:** every inline-numbered verse of every NT reading's pt `texto` (977 readings, modern numbering) was matched by shared content words against the Matos Soares translation in `src/data/nt/books/` (Clementine numbering — translated from the Vulgate, verse-for-verse identical to it, see `scripts/nt/`).

A whole run of consecutive verses matching the neighbouring verse instead of its own appeared in exactly these chapters; elsewhere only isolated single-verse look-alikes (e.g. Jo 3,15/16), which the Latin confirms are right.

| Modern (lectionary) | Clementine Vulgate | Confirmed against |
|---|---|---|
| Mt 17,14-15 | 17,14 | `Mt 17,14-20`, `Mt 17,22-27` |
| Mt 17,16-27 | 17,15-26 | |
| Mc 4,40-41 | 4,40 | `Mc 4,35-41` |
| Mc 9,1 | 8,39 | `Mc 8,34-9,1` |
| Mc 9,2-50 | 9,1-49 | every Mc 9 citation in the corpus |
| Jo 6,51 | 6,51-52 | `Jo 6,41-51`, `Jo 6,44-51`, `Jo 6,51-58` |
| Jo 6,52-71 | 6,53-72 | `Jo 6,52-59`, `Jo 6,60-69` |
| At 7,55-56 | 7,55 | `At 6,8-10;7,54-59` (St. Stephen) |
| At 7,57-60 | 7,56-59 | |

Vulgate 7,59 also holds modern 8,1a.

Modern 8,1 still maps to Vulgate 8,1 (= modern 8,1b), because the parser drops verse letters and the only citations are `7,51-8,1a` and `8,1b-8`: the second is exact, the first keeps the whole-verse overrun every half-verse citation has.

Mt 5,4/5 (the two beatitudes in the opposite order) is deliberately NOT mapped: no citation starts or ends between them, and remapping would print Jerome's verses out of his order.

**Resolver changes:** a map may return two Vulgate verses for one modern verse (Jo 6,51), several modern verses may land on one Vulgate verse (Mt 17,14-15), and a citation never repeats a Vulgate verse across its segments (`Mc 8,34-9,1`: modern 9,1 is Vulgate 8,39, already the end of the first segment).

The `versification-remapped` warning now fires only when a verse actually moved, so the rest of Matthew, Mark, John and Acts stays quiet.

**Verified:** rebuilding the propers changed only `textoLatim`, only for those 19 referências; an independent check that each NT reading's Latin starts and ends on the Clementine verse its first/last pt verse corresponds to went from 32 to 15 failures, and the 15 left are 11 matcher look-alikes, 2 endings on modern Jo 6,51 (the check expects one Vulgate verse there, the right answer is two), the `7,51-8,1a` overrun above, and `Jo 11,45-56`, whose Latin includes v.57 because of a separate upstream defect in scrollmapper's Vulgate (11,57 glued onto 11,56 — repaired in `scripts/nt/lib/latin.mjs` but not here).

## Reference-parser coverage

Ran `test-vulgate.mjs` against **1,876 unique `referencia` strings** — every
distinct reading/psalm/gospel citation across the full harvested API corpus
(`.cache/api/*.json`, ~1,246 dates), not just the 9-item fallback battery.

**Result: 1,876 / 1,876 produced non-empty Latin (100%).**

Handles, beyond the brief's checklist: `" ou <alternate>"` optional-shorter-
reading clauses (keeps the fuller "forma longa", drops the alternative, with
a warning); trailing descriptive annotations (`(mais breve)`, `(Entrada em
Jerusalém)`, `(R. 4a)`, `(R. cf. 7c)`, `(R. Eclo 36,1b)`) stripped unless
that would leave nothing digit-bearing (needed to avoid eating canticle
substitutions — see next point); canticle-substituted psalms (`Sl (Tb 13)`,
`Sl Dn 3`, `Sl Lc 1`, `Sl Is 12`, `Sl (Jr 31)` — resolves to the *named*
book/chapter instead of a psalm number); single-chapter NT books (Jude,
Philemon, 2 John, 3 John) cited as `Book V-V` with no chapter number at all;
spelled-out/alternate book forms seen in the wild (`1 Cor`, `2 Co`,
`Miqueias`, `1Timóteo`, `2Samuel`); `" e "` ("and") used interchangeably with
`.` as a verse-group separator in some psalm refs; per-book Hebrew/Vulgate
chapter-split versification (Zechariah, Joel, Malachi — see above); the
`(A/B)` reversed-order psalm dual-numbering seen once in the corpus; and
cross-chapter ranges in three shapes — `18,1-19,42`; `Mt 26,14-27,66`; the
"restated chapter" shape in `Lc 1,1-4.4,14-21` — including chapter-context
carrying forward across `.`-groups (`2Cor 3,15-4,1.3-6` resolves the
trailing `3-6` against chapter 4, not 3) and a malformed double-hyphen
citation, `2Cor 4, 13-18-5, 1` (one occurrence — interpreted as `4,13-18`
then a jump to `5,1`, confirmed against its pt texto).

All content spot-checked, not just non-emptiness: every ref that needed a
versification or tolerant-parse fix was verified word-for-word against its
real API pt texto (or, for `Sl (71/70)`, against the Vulgate incipit
directly) — see the tables above and the "Sample resolved output" below.

No known gaps remain in the harvested corpus.

## Sample resolved output

```
resolveLatin("Mc 1,14-20") →
"Postquam autem traditus est Joannes, venit Jesus in Galilæam, prædicans
Evangelium regni Dei, et dicens: Quoniam impletum est tempus, et
appropinquavit regnum Dei: pœnitemini, et credite Evangelio. Et præteriens
secus mare Galilææ, vidit Simonem, et Andream fratrem ejus, mittentes retia
in mare (erant enim piscatores), et dixit eis Jesus: Venite post me, et
faciam vos fieri piscatores hominum. Et protinus relictis retibus, secuti
sunt eum. Et progressus inde pusillum, vidit Jacobum Zebedæi, et Joannem
fratrem ejus, et ipsos componentes retia in navi: et statim vocavit illos.
Et relicto patre suo Zebedæo in navi cum mercenariis, secuti sunt eum."
```

```
resolveLatin("Is 52,7-10") →
"Quam pulchri super montes pedes annuntiantis et prædicantis pacem;
annuntiantis bonum, prædicantis salutem, dicentis Sion: Regnabit Deus tuus!
Vox speculatorum tuorum: levaverunt vocem, simul laudabunt, quia oculo ad
oculum videbunt cum converterit Dominus Sion. Gaudete, et laudate simul,
deserta Jerusalem, quia consolatus est Dominus populum suum; redemit
Jerusalem. Paravit Dominus brachium sanctum suum in oculis omnium gentium;
et videbunt omnes fines terræ salutare Dei nostri."
```

Both spot-checked word-for-word against `bible-api.com?translation=clementine`
(along with `Jo 1,1-18`) — identical text, differing only in cosmetic
spacing around `:`/`;` (bible-api's Clementine data spaces before the
punctuation mark; scrollmapper's doesn't).

```
resolveLatin("Ml 3,19-20") →
"Ecce enim dies veniet succensa quasi caminus: et erunt omnes superbi et
omnes facientes impietatem stipula: et inflammabit eos dies veniens, dicit
Dominus exercituum, quæ non derelinquet eis radicem et germen. Et orietur
vobis timentibus nomen meum sol justitiæ, et sanitas in pennis ejus: et
egrediemini, et salietis sicut vituli de armento."
```

(Vulgate Mal 4:1-2 under the hood — modern chapter 3 verses 19-20 versified
to Vulgate chapter 4 verses 1-2, per the "Versification" section above.)

## `latin` string format

`resolveLatin` joins verses with a single space and **no inline verse
numbers** — continuous prose, matching how the app already stores its other
bundled prayer/reading text (`.prose-prayer` rendering, not a numbered
reference layout).
