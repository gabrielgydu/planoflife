// Device preferences that sync across devices. These live in localStorage (not
// Dexie). When a pulled snapshot changes them, we write them and notify the
// settings hooks so the UI updates live without a reload.
//
// Excluded on purpose: 'morning-flow-last-reviewed-date' is transient per-device
// flow state, not a preference — syncing it could wrongly skip the morning review.

export const SYNCED_SETTING_KEYS = [
  'theme-mode',
  'settings-practice-font-size',
  'settings-ui-font-size',
  'settings-examen-proposito-target',
  'settings-individual-reasons',
] as const

// Two distinct events, on purpose:
//  - SETTINGS_EVENT: a REMOTE snapshot changed a setting → hooks refresh the UI.
//    Must NOT trigger a push (that would echo the pull back to the cloud).
//  - LOCAL_SETTINGS_EVENT: the USER changed a setting in the UI → sync should push.
const SETTINGS_EVENT = 'planoflife:settings-changed'
const LOCAL_SETTINGS_EVENT = 'planoflife:settings-local-changed'

// Setting keys the user changed locally since the last successful push. On a
// push conflict only these override the remote, so a concurrent setting change
// on the other device isn't clobbered (settings carry no per-key timestamp).
const locallyChangedKeys = new Set<string>()

/**
 * Write a synced setting locally and notify the sync layer to push it. Settings
 * hooks use this instead of localStorage.setItem so a pref edit propagates to
 * other devices (Phase 4). Non-synced keys should keep using localStorage directly.
 */
export function setSyncedSetting(key: string, value: string): void {
  localStorage.setItem(key, value)
  locallyChangedKeys.add(key)
  window.dispatchEvent(new Event(LOCAL_SETTINGS_EVENT))
}

/** Keys changed locally since the last successful push (for conflict merge). */
export function getLocallyChangedSettingKeys(): string[] {
  return [...locallyChangedKeys]
}

/**
 * Called after a successful push: forget exactly the keys that were in the pushed
 * snapshot. NOT a blanket clear — a setting changed during the push round-trip (so
 * not in that snapshot) must stay tracked, or a following conflict would clobber it.
 */
export function markSettingsPushed(pushedKeys: Iterable<string>): void {
  for (const k of pushedKeys) locallyChangedKeys.delete(k)
}

/** Full reset of local-change tracking (on adopt/disconnect). */
export function clearLocallyChangedSettings(): void {
  locallyChangedKeys.clear()
}

/** Subscribe the sync layer to user-initiated synced-setting writes. */
export function onLocalSettingChanged(cb: () => void): () => void {
  window.addEventListener(LOCAL_SETTINGS_EVENT, cb)
  return () => window.removeEventListener(LOCAL_SETTINGS_EVENT, cb)
}

/** Snapshot the synced settings from localStorage. */
export function collectSettings(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of SYNCED_SETTING_KEYS) {
    const v = localStorage.getItem(k)
    if (v != null) out[k] = v
  }
  return out
}

/** Apply incoming settings to localStorage. Returns true if anything changed. */
export function applySettings(settings: Record<string, string> | undefined): boolean {
  if (!settings) return false
  let changed = false
  for (const k of SYNCED_SETTING_KEYS) {
    const incoming = settings[k]
    if (incoming == null) continue
    if (localStorage.getItem(k) !== incoming) {
      localStorage.setItem(k, incoming)
      changed = true
    }
  }
  if (changed) window.dispatchEvent(new Event(SETTINGS_EVENT))
  return changed
}

/** Subscribe a settings hook to live updates from a pulled snapshot. */
export function onSettingsChanged(cb: () => void): () => void {
  window.addEventListener(SETTINGS_EVENT, cb)
  return () => window.removeEventListener(SETTINGS_EVENT, cb)
}
