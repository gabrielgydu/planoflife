# Plano de Vida — Sync Handoff

Status as of **2026-06-04**. Read this before continuing sync work in a new session.
Companion memory: `~/.claude/projects/-home-gabriel-development-planoflife/memory/`
(`sync-architecture.md`, `planoflife-data-model.md`).

---

## 1. What this is

Cross-device login + end-to-end-encrypted sync added to an otherwise local-first
React + Dexie (IndexedDB) PWA. One passphrase logs Gabriel in on any device; data
syncs through a tiny Cloudflare Worker that only ever stores **ciphertext**.

**Phases 1–4 are DONE. Phases 1–3 deployed in production; Phase 4 is implemented +
locally verified (e2e 11/11) and ready to deploy.**

- ✅ **Phase 1** — Cloudflare Worker + KV backend.
- ✅ **Phase 2** — shared crypto + `scripts/sync.mjs` CLI (pull/push/seed).
- ✅ **Phase 3** — browser client: login (passphrase), pull on load/focus, device-pref
  sync, `Sincronização` settings UI.
- ✅ **Phase 4** — auto-push from inside the app. Dexie `creating/updating/deleting`
  hooks on all 7 tables → debounced (1.5s) encrypted push; pull on focus/visibility +
  **60s polling while visible**; **per-record conflict merge** on 409; cheap
  `GET /state?meta=1` version probe so idle pulls don't re-download the blob. Now an
  edit made *inside the app* on one device propagates to the other. **See §8 for the
  design and the fixes from two adversarial review passes.**

---

## 2. Current capability (be precise with the user)

| Flow | Works today? |
|------|--------------|
| Cloud → device, on app open / window focus / tab visible / **60s poll** | ✅ |
| Desktop/Claude edits via **CLI** (`npm run sync:push`) → cloud → phone | ✅ |
| Edit **inside the app** on a device → cloud → other device | ✅ Phase 4 |
| Concurrent edits on two devices (409) → per-record merge, no data loss | ✅ Phase 4 |
| End-to-end encryption (Worker sees only ciphertext) | ✅ |
| Device prefs (theme, font sizes, examen target) sync | ✅ |

> **Deploy state:** Phase 4 app code is built + verified locally but **not yet pushed
> to master** at the time of writing (per request: review/test on real devices first).
> The Worker's `?meta=1` endpoint is additive + backward-compatible; until the Worker is
> redeployed the app still works (it just re-downloads the blob on each idle pull).

---

## 3. Architecture

```
Phone PWA  ─┐                         ┌─ Cloudflare Worker (planoflife-sync)
Desktop    ─┼─ encrypt(blob) ⇄ HTTPS ─┤    GET/PUT/DELETE /state, /health
CLI/Claude ─┘   (ciphertext only)     └─ KV: { state:blob, state:version, state:salt }
```

- **Snapshot model**: the whole DB (7 tables) + synced settings is serialized to one
  `SyncState`, encrypted, and stored as a single blob. Last-write-wins guarded by a
  monotonic `version`. Chosen because 4/7 tables lack `updatedAt` so per-record merge
  is unreliable; snapshot replace also handles deletes for free.
- **Auth**: bearer token = `PBKDF2(passphrase, fixed app salt)`. The Worker compares it
  to the `SYNC_TOKEN` secret. Token ≠ encryption key.
- **Encryption**: key = `PBKDF2(passphrase, random per-account salt)` → AES-GCM-256.
  Key is stored as a **non-extractable `CryptoKey` in a dedicated IndexedDB**
  (`PlanOfLifeSync`), so the passphrase is entered once per device and the raw key is
  never exposed to JS.
- **Secure context required**: `crypto.subtle` is undefined over `http://`. Sync only
  works over **https:// or localhost**. Guarded by `assertCryptoAvailable()`.

---

## 4. Canonical crypto / wire formats — DO NOT CHANGE without migrating

Identical constants live in THREE places (keep them in sync):
`worker/derive-token.mjs`, `scripts/sync-core.mjs`, `src/sync/syncCrypto.ts`.

```
AUTH_SALT       = utf8("planoflife-sync/auth/v1")   # fixed
AUTH_ITERATIONS = 310000   (PBKDF2-SHA256, 32 bytes) → authToken = base64url
ENC_ITERATIONS  = 600000   (PBKDF2-SHA256 → AES-GCM-256)
ENC account salt= 16 random bytes, minted on first push, stored in KV, never changed
IV              = 12 random bytes per encryption
blob   = base64( IV(12) || AES-GCM-256(encKey, IV, utf8(JSON.stringify(SyncState))) )
salt   = base64( accountSalt )            # stored separately in KV, returned by GET
```

```ts
SyncState = {
  schema: 1,
  data: { categories, practices, dailyRecords, missedReasons,
          examenEntries, guidingQuestions, propositos },   // arrays, full tables
  settings: { [k: string]: string }   // synced localStorage keys (see below)
}
```

Synced settings keys (in `src/sync/settingsBus.ts`):
`theme-mode`, `settings-practice-font-size`, `settings-ui-font-size`,
`settings-examen-proposito-target`, `settings-individual-reasons`.
**Excluded on purpose**: `morning-flow-last-reviewed-date` (transient per-device).

---

## 5. Worker API

`GET /health` → `{ok:true}` (no auth). All else needs `Authorization: Bearer <token>`.
- `GET /state` → `{ version, blob|null, salt|null }`
- `PUT /state` body `{ baseVersion, blob, salt? }` → `{version}`; **409** if `baseVersion`
  ≠ stored version. Account `salt` is set once and never overwritten.
- `DELETE /state` → wipes all keys (reset).

Fails **closed**: if `SYNC_TOKEN` secret is unset, every authed route → 401.

---

## 6. Deployment facts (production)

- **Worker URL**: `https://planoflife-sync.gabrielschutz.workers.dev`
- **CF account id**: `47416209cb62c2fb14fc98bb92c6dc76`
- **KV namespace id**: `79fdd0c03e6c4fada9025c2ce67a3991` (binding `SYNC_KV`)
- **workers.dev subdomain**: `gabrielschutz`; `preview_urls = false`
- **App**: GitHub Pages, deployed by `.github/workflows/deploy.yml` on push to `master`
  (`npm run build` → `dist` → Pages). Vite base is **`/planoflife/`**.
- **Domain ownership gotcha**: `gabrielschutz.de` is owned by the **`gabrielgydu.github.io`
  user-pages repo** (legacy/branch source). `planoflife` is a *project page* served at
  `/planoflife/`. The TLS cert lives on `gabrielgydu.github.io`, NOT here. Do **not** try
  to register the domain on `planoflife` (409 "already taken").
- **HTTPS**: the cert was stuck in ACME `bad_authz` for weeks. Fixed by Remove + re-add
  the custom domain in `gabrielgydu.github.io` → Settings → Pages, then Enforce HTTPS.
  Now live. DNS: A → GitHub IPs, `www` → github.io, no CAA.
- **Worker URL baked into app** via `.env.production` (`VITE_SYNC_URL`), so the Sync
  field pre-fills. A localStorage value (entered in the app) overrides it.

### Redeploy the Worker
```
cd worker && npm install
npx wrangler login            # OR export CLOUDFLARE_API_TOKEN=<scoped token>
npx wrangler deploy
```
Set/rotate the secret (passphrase stays local; run in YOUR terminal):
```
SYNC_PASSPHRASE='...' node worker/derive-token.mjs | (cd worker && npx wrangler secret put SYNC_TOKEN)
```

### CLI (desktop/Claude editing)
`.env.local` (gitignored): `SYNC_URL=...`, `SYNC_PASSPHRASE=...`
```
npm run sync:status
npm run sync:pull           # cloud → .sync/state.json
# edit .sync/state.json
npm run sync:push           # .sync/state.json → cloud (--force to override version)
node scripts/sync.mjs seed-from-backup <app-backup.json>
```

---

## 7. Files (all under repo root)

**Worker** (`worker/`): `src/index.ts`, `wrangler.toml` (has KV id + ALLOWED_ORIGINS),
`derive-token.mjs`, `package.json`, `tsconfig.json`, `README.md`,
`.dev.vars` (gitignored: SYNC_TOKEN + ALLOWED_ORIGINS for local dev),
`.cf-token` (gitignored, should be deleted after deploy).

**Scripts**: `scripts/sync-core.mjs` (canonical crypto + SyncState helpers),
`scripts/sync.mjs` (CLI), `scripts/postbuild.mjs` (copies index.html→404.html for SPA).

**Client** (`src/sync/`): `types.ts`, `config.ts`, `syncCrypto.ts` (browser crypto +
`isCryptoAvailable`/`assertCryptoAvailable`), `keyStore.ts` (CryptoKey in IndexedDB),
`syncClient.ts` (`fetchRemote`/`pushRemote`, `SyncAuthError`/`SyncConflictError`),
`settingsBus.ts`, `applyState.ts` (`snapshotLocal`, `applyRemoteState`, `hasUserData`),
`SyncProvider.tsx` (context: status/connect/syncNow/disconnect/confirmAdopt).
`src/components/sync/SyncSettingsSection.tsx` (the Sincronização UI).

**Other**: `src/db/init.ts` (`dbReady` — seeds/migrates once; `applyRemoteState` awaits
it to avoid a BulkError race). Modified: `src/App.tsx` (wraps in `SyncProvider`, imports
`./db/init`), `src/components/settings/SettingsView.tsx`, `src/hooks/useSettings.ts` +
`useThemeMode.ts` (subscribe to `onSettingsChanged` for live pref updates),
`.env.production`, `.env.local.example`, `package.json`, `.gitignore`.

**Commits on master**: `88d21b0` (phases 1–3), `963caaf` (HTTPS guard),
`f3a442a` (SPA 404 fallback).

---

## 8. PHASE 4 — auto-push from inside the app  ✅ IMPLEMENTED

**As built** (files: new `src/sync/mutationCapture.ts`, `src/sync/merge.ts`; modified
`src/sync/applyState.ts`, `SyncProvider.tsx`, `syncClient.ts`, `settingsBus.ts`,
`src/hooks/use{Settings,ThemeMode,DailyRecords}.ts`, `src/db/index.ts`,
`src/types/index.ts`, `worker/src/index.ts`):

- **Capture**: `mutationCapture.ts` installs Dexie `creating/updating/deleting` hooks on
  all 7 tables → `markDirty()`. A module-level `applyingRemote` flag (set by
  `runWithApplyingRemote`, wrapping every remote-apply) makes `markDirty` a no-op during
  a pull → **no echo loop**. Settings: user pref writes go through
  `settingsBus.setSyncedSetting()` which fires a *local* event (distinct from the
  *remote-apply* event) that the provider listens to.
- **Push**: `SyncProvider.pushNow()` debounced 1.5s: `snapshotLocal → encryptState →
  pushRemote(baseVersion)`. Gated on `unlocked && initialPullDone`. `syncingRef`
  serializes pull vs push.
- **Pull-safety**: `syncNow()` bails to a push when `dirtyRef` is set (never
  pull-overwrites unpushed local edits), and re-checks dirty right before applying.
- **Conflict (409)**: pull remote → **`mergeRemoteIntoLocal()`** (reads local + merges +
  rewrites tables in ONE Dexie transaction, so no concurrent write is lost) → retry,
  bounded to 3 attempts.
- **Merge** (`merge.ts`): per record. categories/practices/examenEntries/**dailyRecords**
  by newest `updatedAt`; missedReasons/guidingQuestions/propositos keep-ours; settings
  overlay only *locally-changed* keys. No tombstones → a delete can resurrect on a
  conflict (accepted for one user).
- **Polling**: 60s `setInterval` while `unlocked && visible`, plus the existing
  focus/visibility pulls.
- **Cheap version probe**: `GET /state?meta=1` returns `{version, blob:null, salt}`;
  `syncNow` checks it before a full GET so idle pulls don't re-download the blob.
  Backward-compatible (old Worker ignores the param). **Worker must be redeployed for
  the saving to kick in** (`cd worker && npx wrangler deploy`).

**Schema change**: `DailyRecord` gained `updatedAt` (Dexie **v5** migration backfills it
= `completedAt ?? epoch`). Needed so an explicit *un-check* (`completedAt=null`) wins the
merge over a stale completion instead of being silently reverted.

**Two adversarial review passes** (multi-agent) found + fixed: dailyRecords un-check
reversion (→ `updatedAt`), a conflict lost-write race (→ atomic `mergeRemoteIntoLocal`),
settings ours-wins clobber (→ locally-changed-keys), multi-tab null-salt silent drop,
null-blob-on-conflict guard, and `connect()` persisting the URL before validating.

**Verify**: `node scripts/e2e-phase4.mjs` — builds, runs a local Worker (port 8799) +
`vite preview` (5183), drives two isolated browser contexts; asserts push, pull, **no
echo** (version unchanged after the other device pulls), settings sync, and **conflict
convergence** (divergent edits to different records all survive). 11/11 green.

---

### Original plan (kept for reference)

**Goal**: a write made inside the app (mark done, add examen, edit practice, change a
pref) is encrypted and pushed to the cloud, so other devices get it on their next
pull (focus/open). Add optional periodic polling so an idle-but-open device refreshes.

### 8.1 Mutation capture
There is no write choke-point — hooks call `db.<table>.add/update/delete` directly.
Install capture **at the Dexie layer** so all writes are caught:
- In `src/db/index.ts` (or a new `src/sync/mutationCapture.ts` imported once), register
  `db.<table>.hook('creating' | 'updating' | 'deleting')` on all 7 tables, each calling
  `markDirty()`. (Dexie hooks fire inside transactions too, e.g. `deletePractice`.)
- Export a module-level `applyingRemote` flag (move it here or into `applyState`).
  `applyRemoteState` sets it `true` around its clear+bulkAdd; `markDirty()` **ignores
  writes while `applyingRemote` is true** → prevents pull→push echo loops.
- Also ignore writes during initial seed: gate push on `unlocked && initialPullDone`.

### 8.2 Debounced push (in SyncProvider)
- `markDirty()` schedules `pushNow()` ~2s later (debounce; reset timer on each write).
- `pushNow()`: `const state = await snapshotLocal()` → `encryptState(state, key)` →
  `pushRemote(url, token, { baseVersion: getSyncVersion(), blob, salt })`.
  On success `setSyncVersion(res.version)` + `setLastSyncedAt`.
- Guard against concurrent push/pull with a flag; coalesce.

### 8.3 Conflict (409) — single-user, rare
On `SyncConflictError`: the device is behind. Simplest correct-for-one-user behavior:
pull remote (`applyRemoteState`) then re-push current local. **Caveat**: a naive
pull-then-repush can drop the just-made local edit (snapshot LWW). Two options:
- (a) **LWW + local backup**: before adopting remote on conflict, stash the local
  snapshot (download or keep in IDB) so nothing is truly lost; log it. Fine for 1 user.
- (b) **Client-side per-record merge** (better): decrypt remote, merge with local by
  record `id` using `updatedAt` (newest wins), push merged. Recovers concurrent edits to
  *different* records. Still resurrects deletes (no tombstones) — acceptable, or add
  tombstones (Phase 5).
Pick (a) for a quick ship, note (b)/tombstones as the robust upgrade.

### 8.4 Polling (optional, recommended for the user's ask)
Add a `setInterval` (~45–60s) while `unlocked && document.visibilityState==='visible'`
calling `syncNow()`, so an idle desktop refreshes without a focus event. Clear on
lock/unmount.

### 8.5 Files to touch
`src/db/index.ts` (or new mutationCapture), `src/sync/applyState.ts` (`applyingRemote`),
`src/sync/SyncProvider.tsx` (debounced push, conflict, polling, expose state),
maybe `src/components/sync/SyncSettingsSection.tsx` (show "pending push" status).

### 8.6 Verify Phase 4
- Extend the headless test (see §9): connect two isolated browser contexts to the same
  cloud; change a record in A; focus B; assert it appears in B. Assert a **pull does NOT
  trigger a push** (no echo loop — watch the version counter / network). Test the 409 path.
- `tsc -b` + `npm run build` clean. Deploy via push to master.

---

## 9. How to test locally (no Cloudflare account needed)

```
# Worker locally (NOTE: --ip 127.0.0.1 — IPv6 loopback fails in some sandboxes):
cd worker
printf 'SYNC_TOKEN=<token-for-test-pass>\nALLOWED_ORIGINS=http://localhost:5173,https://gabrielschutz.de\n' > .dev.vars
npx wrangler dev --ip 127.0.0.1 --port 8787 --local

# CLI round-trip against it:
SYNC_URL=http://127.0.0.1:8787 SYNC_PASSPHRASE=test-pass-123 node scripts/sync.mjs status

# App against local worker (localhost is a secure context):
npm run dev   # http://localhost:5173/planoflife/  (worker CORS already allows :5173)
```

Headless e2e pattern used in Phase 3 (Playwright is global; resolve via
`createRequire(process.env.GLOBAL_MODULES + '/')` where `GLOBAL_MODULES=$(npm root -g)`):
launch chromium → goto `/planoflife/settings` → fill `input[type=url]` + `input[type=password]`
→ click "Conectar" → wait for "Sincronizado" → assert seeded data renders.

---

## 10. Gotchas / lessons (so you don't relearn them)

- **Secure context**: sync needs https/localhost; `crypto.subtle` is undefined over http.
- **Domain/cert**: see §6. Cert on `gabrielgydu.github.io`, not here.
- **Seed/apply race**: `applyRemoteState` must `await dbReady` (already does). Don't
  remove. Phase 4's mutation capture must skip seed + remote-apply writes.
- **`pkill -f 'wrangler dev'` kills your own shell** (its argv matches). Use `pkill -x
  workerd` or kill by port.
- **wrangler dev** binds IPv6 `[::1]` by default and fails in sandboxes → `--ip 127.0.0.1`.
- **CORS**: Worker `ALLOWED_ORIGINS` (prod in `wrangler.toml`) = `https://gabrielschutz.de,
  http://localhost:5173`. Add any new dev origin there + redeploy.
- **Port 5173** is often taken by another project (invoicer) — check `cwd` of the PID.
- **iOS PWA** keeps the scheme it was installed with; re-add from https after fixing certs.

---

## 11. Security / housekeeping

- E2E: Worker stores only ciphertext. Passphrase = encryption key AND (derived) auth
  token; never sent in plaintext, never in this repo.
- Gitignored secrets: `.env.local`, `.sync/`, `worker/.dev.vars`, `worker/.cf-token`.
- **Outstanding housekeeping for Gabriel**: revoke the Cloudflare API token + delete
  `worker/.cf-token`; change the Cloudflare account password (it was pasted in chat).
- Lost passphrase = unreadable cloud copy, but local IndexedDB + file backups remain;
  just set a new passphrase and re-seed.

---

## 12. Future (Phase 5+)

- **Tombstones / per-record merge** for bulletproof concurrent-offline editing.
- **Realtime**: swap KV for a Durable Object (atomic CAS + WebSocket push) — DO also
  fixes the KV eventual-consistency caveat on the version guard.
- **Image blobs**: `practice.imageData` (base64) rides in every snapshot; split into
  separate KV keys if the blob grows.
- **Per-device pref override** (e.g. font size) if syncing them becomes annoying.
- **`sync.gabrielschutz.de`** custom Worker route (needs moving DNS to Cloudflare).
- Bump GitHub Actions off deprecated Node 20 actions (warning in deploy logs).
