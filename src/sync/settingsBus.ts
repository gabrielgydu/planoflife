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

const SETTINGS_EVENT = 'planoflife:settings-changed'

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
