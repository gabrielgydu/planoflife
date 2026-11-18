# Plan — prayer intentions list (Intenções)

Written 2026-11-18.

**Status:** design agreed in conversation, nothing built.

Phase 1 is ready to start on Gabriel's go-ahead.

**Privacy rule:** the repo and the Pages bundle are public, so real names never go into code, seed data, this plan or a commit.

His intentions live only in his synced data, entered in the app (or through the sync CLI if he dictates a first list).

All examples below are placeholders.

## Decisions taken (2026-11-18)

| Question | Decision |
|---|---|
| What it is | A list of people and intentions to pray for: vocations, family, afilhados, friends, apostolado, intentions others asked for. |
| Structure | Groups he creates; inside each group an intention is just free text. |
| Extra fields | None — no "quem pediu", no end date, no note. Adding must be as fast as possible. |
| Editing | Easy add, delete, and drag-to-reorder. |
| Frequency | Pinned intentions come up every day; the rest rotate, N per day, walking down the list order and wrapping around. |
| Where prayed | A button in the Santa Missa screen opens today's set; a "Ver todas" link opens the full list. |
| Full list | Also reachable from a "Minhas intenções" row in the Devocionário tab. |
| Rosary | Not integrated (the rosary engine's fixed closing "Intenções" step stays as it is). |
| When done | Archive only — no "graças alcançadas" log. |

## 1. Data model

Two new synced tables, both bare stores with no upgrade body (same shape as `jaculatorias`, v27):

```ts
interface IntentionGroup {
  id: string          // generateId() UUID
  name: string        // e.g. "Vocações", "Pedidos"
  sortOrder: number   // group order on the list page
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

interface Intention {
  id: string          // generateId() UUID
  groupId: string
  text: string        // e.g. "Pela vocação de Fulano"
  isPinned: boolean   // comes up every day
  isArchived: boolean
  sortOrder: number   // order within its group
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}
```

Dexie: `version(29).stores({ intentionGroups: 'id', intentions: 'id, groupId' })`.

Delete keeps the row with `isDeleted: true`, the same no-tombstone rule as `Jaculatoria` and the NT verse marks: a hard delete can be resurrected by the 409 union merge.

One row per intention (not a group row with a nested array) so concurrent edits on two devices merge per intention instead of losing writes.

Reordering rewrites `sortOrder` 0..n-1 inside the group and bumps `updatedAt` only on rows whose position changed, as `reorderPractices` does.

**Rotation size N** is a synced setting, `settings-intentions-per-day`, default 5, added to `SYNCED_SETTING_KEYS` in `src/sync/settingsBus.ts`.

It has to be synced so both devices show the same set.

A snapshot without the key leaves the local value alone (`applySettings` skips missing keys), so the setting needs no schema bump of its own.

## 2. Sync and storage checklist

The same file set as the last synced tables (9872033 favorites, c03c731 jaculatórias, 000852b verse marks):

1. `src/types/index.ts` — `IntentionGroup`, `Intention`.
2. `src/db/index.ts` — table declarations + `version(29)`; update the version ledger comment.
3. `src/sync/types.ts` — `SYNC_SCHEMA = 11`, two `SyncState.data` keys with the "missing key = older client, preserve local" comment, `SYNC_TABLES`.
4. `src/sync/applyState.ts` — `ALL_TABLES`, `snapshotLocal`, apply (preserve local when the key is missing), `hasUserData` (neither table is seeded, so both count as user data).
5. `src/sync/merge.ts` — `mergeById(… ?? [], … ?? [], newerUpdatedAt)` for both.
6. `src/sync/mutationCapture.ts` — hooks on both tables.
7. `src/utils/backup.ts` — export and import.
8. `scripts/sync-core.mjs` — a new table-group constant, `SYNC_SCHEMA = 11`, `validateSyncState`.

**Version collision:** Dexie v29 / sync schema 11 are also pencilled in for the Direção espiritual brainstorm (`PLAN-DIRECAO-ESPIRITUAL.md`, not chosen yet).

Whichever ships first takes them; the other moves to v30 / schema 12.

Then the deploy rule from CLAUDE.md: after the schema-11 deploy, open/refresh the app on both devices before the next publish.

## 3. Today's set (the rotation)

A pure function, `intentionsForDay(groups, intentions, date, n)`, in a new `src/data/intentions.ts`:

1. **Pinned:** every active pinned intention (not archived, not deleted), in list order.
2. **Pool:** every other active intention, in list order — groups by `sortOrder`, then intentions by `sortOrder` inside each group.
3. **Window:** `dayIndex` = calendar days since a fixed epoch date (date-fns `differenceInCalendarDays`); `start = (dayIndex × n) mod pool.length`; take `min(n, pool.length)` items from `start`, wrapping around.

Both devices compute the same set from the date, so there is no cursor to sync.

The function takes the date the Missa screen is showing, so viewing another day shows that day's set.

Known trade-off: adding, archiving or reordering changes the pool, so the window shifts and one cycle may skip or repeat an intention.

Fixing that would need a per-intention "last shown" date; not worth it unless it bothers him in use.

## 4. List page — `/devocionario/intencoes`

Reached from a "Minhas intenções" row at the top of the Devocionário, linked with `useBackState` and closed with `useGoBack('/devocionario')` like the other Devocionário pages.

- **Groups** as headed sections, each with its intentions in a `SortableList` (dnd-kit, already used by `GuidingQuestionsList`).
- **Add:** one text field plus a group picker that remembers the last group used; the picker's "+ Novo grupo" creates a group inline.

  With no groups yet, the first add asks for a group name.
- **Per intention:** tap to edit the text or move it to another group; pin toggle; archive; delete (with confirm).
- **Per group:** rename; delete (confirm names how many intentions go with it).
- **Reordering groups:** a "Reordenar grupos" toggle collapses the sections to their headers and makes those draggable.

  Two drag levels on one screen would fight over the same gesture.
- **Arquivadas:** a collapsed section at the bottom, with restore and delete.
- **N per day:** a small stepper in the page header ("5 por dia").

## 5. Santa Missa — "Intenções de hoje"

A button in the `LiturgiaView` header, left of the mark-done toggle, opens a bottom sheet (the `JaculatoriasSheet` pattern):

- **Sempre:** the pinned intentions.
- **Hoje:** today's rotating window.
- **Ver todas:** opens the list page.

The button works in every load state of the liturgy (loading, error, offline), since the intentions are local.

**Check while building:** `LiturgiaView` is an overlay opened from `DailyView`.

Find out whether going to the list page and back reopens the Missa screen; if it doesn't, "Ver todas" should show the full list inside the overlay instead of navigating away.

Losing the Missa screen in the middle of Mass would be a real annoyance.

## 6. Phases

Each phase ends with `npm run build` clean, commit, push, `gh run watch` green, and a report; wait for a go-ahead before the next.

There is no unit test runner in the repo, so behavior is verified with scripted playwright-cli runs, as in earlier features.

1. **Data and sync** (no UI).
   - Verify a real v28 → v29 upgrade (HEAD build, then the new build on the same origin) keeps existing data.
   - Verify `mergeStates` with conflicting intentions resolves newest-wins per row, and that a schema-10 snapshot without the new keys preserves local rows.
   - Verify a backup round-trip.
   - **After deploy, Gabriel refreshes both devices** before phase 2 ships.
2. **List page** + the Devocionário row: groups, add/edit/pin/archive/delete, drag reorder, Arquivadas, the N stepper.
3. **Santa Missa button and sheet**, plus `intentionsForDay`.
   - Check the rotation over consecutive dates: windows tile the pool without gaps and wrap at the end; a pool smaller than N shows everything once; pinned intentions never appear in the window.

Final check on the iPhone by Gabriel: drag feel on touch, the sheet during Mass, and that both devices show the same set on the same day.

Memory to update afterwards: the Dexie ledger in `adding-tracked-practices` (v29, next v30) and `intentions-module`.

## 7. Defaults I picked (say if any should change)

- N = 5 per day.
- No hide toggle: names show openly in the Missa sheet (Perdón entries hide behind an eye toggle; intentions don't).
- Groups start empty; nothing is seeded.
- Moving an intention between groups goes through its edit form, not drag.
- Deleting a group deletes its intentions too, after a confirm that says how many.
- No tracking: praying the intentions is not a practice to tick and leaves no history.
