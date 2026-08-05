// Per-record merge used ONLY on a push conflict (HTTP 409) — i.e. when this
// device tried to push but the cloud had already advanced (a second device
// pushed first). For a single user editing two devices, merging by record beats
// last-write-wins because it never silently drops a "marked done", an un-check,
// or an examen entry made on the losing device.
//
// Caveat: there are no tombstones, so the union resurrects a record that was
// deleted on one device but still present in the other snapshot. Acceptable for
// one user (just delete it again); add tombstones for real multi-user merge.

import { SYNC_SCHEMA, type SyncState } from './types'

function mergeById<T extends { id: string }>(
  base: T[],
  ours: T[],
  pick: (b: T, o: T) => T
): T[] {
  const out = new Map<string, T>()
  for (const b of base) out.set(b.id, b)
  for (const o of ours) {
    const existing = out.get(o.id)
    out.set(o.id, existing ? pick(existing, o) : o)
  }
  return [...out.values()]
}

// ISO-8601 UTC strings (always "…Z") compare chronologically as plain strings.
// Tolerates a missing updatedAt (treated as oldest) so an edited record — which
// always carries one — beats a never-touched legacy record that lacks it.
const newerUpdatedAt = <T extends { id: string; updatedAt?: string }>(b: T, o: T): T =>
  (o.updatedAt ?? '') >= (b.updatedAt ?? '') ? o : b // ties → ours

// missedReasons / guidingQuestions / propositos have only createdAt — no
// updatedAt to resolve concurrent edits — so on a same-id clash keep our local
// copy (local edits win). They may be edited after creation (text, sortOrder,
// isArchived, date, reasonText); per-field timestamps would be needed to do better.
const keepOurs = <T>(_b: T, o: T): T => o

/**
 * Merge a remote snapshot (`base`, just fetched from the cloud) with the local
 * snapshot (`ours`). Result is a full SyncState safe to apply locally and push.
 *
 * `oursSettingKeys`, when given, are the setting keys the user changed locally
 * since the last successful push; only those override the remote on conflict, so
 * a concurrent setting change on the other device isn't clobbered. When omitted,
 * settings fall back to ours-wins per key.
 */
export function mergeStates(
  base: SyncState,
  ours: SyncState,
  oursSettingKeys?: Iterable<string>
): SyncState {
  const settings: Record<string, string> = { ...base.settings }
  if (oursSettingKeys) {
    for (const k of oursSettingKeys) {
      const v = ours.settings[k]
      if (v != null) settings[k] = v
    }
  } else {
    Object.assign(settings, ours.settings)
  }

  return {
    schema: SYNC_SCHEMA,
    data: {
      categories: mergeById(base.data.categories, ours.data.categories, newerUpdatedAt),
      practices: mergeById(base.data.practices, ours.data.practices, newerUpdatedAt),
      // dailyRecords now carry updatedAt (bumped on every check/uncheck), so an
      // explicit un-check (completedAt=null) correctly wins over a stale done.
      dailyRecords: mergeById(base.data.dailyRecords, ours.data.dailyRecords, newerUpdatedAt),
      missedReasons: mergeById(base.data.missedReasons, ours.data.missedReasons, keepOurs),
      examenEntries: mergeById(base.data.examenEntries, ours.data.examenEntries, newerUpdatedAt),
      guidingQuestions: mergeById(
        base.data.guidingQuestions,
        ours.data.guidingQuestions,
        keepOurs
      ),
      propositos: mergeById(base.data.propositos, ours.data.propositos, keepOurs),
      // Career tables all carry updatedAt. `?? []` because a snapshot pushed by a
      // schema-1 client lacks these keys entirely — the union with ours then keeps
      // every local row, and pushing the merged result restores them in the cloud.
      careerPlan: mergeById(base.data.careerPlan ?? [], ours.data.careerPlan ?? [], newerUpdatedAt),
      careerMoves: mergeById(base.data.careerMoves ?? [], ours.data.careerMoves ?? [], newerUpdatedAt),
      careerDeadlines: mergeById(
        base.data.careerDeadlines ?? [],
        ours.data.careerDeadlines ?? [],
        newerUpdatedAt
      ),
      careerOutreach: mergeById(
        base.data.careerOutreach ?? [],
        ours.data.careerOutreach ?? [],
        newerUpdatedAt
      ),
      careerLadder: mergeById(
        base.data.careerLadder ?? [],
        ours.data.careerLadder ?? [],
        newerUpdatedAt
      ),
      careerWins: mergeById(base.data.careerWins ?? [], ours.data.careerWins ?? [], newerUpdatedAt),
      careerLog: mergeById(base.data.careerLog ?? [], ours.data.careerLog ?? [], newerUpdatedAt),
      // Meditação: keyed by date (= id), updatedAt bumped on draw + reroll, so a
      // concurrent reroll on two devices resolves deterministically (newer wins).
      // `?? []` tolerates a schema-≤2 snapshot that lacks the key (preserve ours).
      meditationDays: mergeById(
        base.data.meditationDays ?? [],
        ours.data.meditationDays ?? [],
        newerUpdatedAt,
      ),
      // Reading position: fixed-id rows — one pointer per track ('nt') plus one
      // bookmark per book ('nt:<book>') — rewritten as you read. Newest wins, PER
      // ROW: if both devices read offline the later one is where the track resumes,
      // and a book only touched on one device keeps that device's bookmark instead
      // of being clobbered by the other's. `?? []` tolerates a schema-≤3 snapshot
      // (preserve ours).
      readingPositions: mergeById(
        base.data.readingPositions ?? [],
        ours.data.readingPositions ?? [],
        newerUpdatedAt,
      ),
      // Devocionário: the bundled prayers carry the same FIXED slug id on every
      // device, so the union collapses the two independent seeds into one book;
      // favorites, reorders and edits are ordinary updatedAt-recency wins. `?? []`
      // tolerates a schema-≤4 snapshot (preserve ours).
      prayers: mergeById(base.data.prayers ?? [], ours.data.prayers ?? [], newerUpdatedAt),
      // Exame particular: edits, conclusions and guidance notes all bump
      // updatedAt, so recency wins per tema; the v24-migrated row carries the
      // same FIXED id on both devices, so the union collapses the two
      // independent migrations into one. `?? []` tolerates a schema-≤5
      // snapshot (preserve ours).
      exameTemas: mergeById(base.data.exameTemas ?? [], ours.data.exameTemas ?? [], newerUpdatedAt),
    },
    settings,
  }
}
