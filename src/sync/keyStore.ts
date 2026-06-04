// Stores the non-extractable AES CryptoKey in a dedicated IndexedDB so the
// passphrase is entered once per device and the raw key is never exposed to JS.
// Kept separate from the Dexie app DB so the app schema is untouched.

const DB_NAME = 'PlanOfLifeSync'
const STORE = 'kv'
const KEY_ID = 'encKey'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function saveEncKey(key: CryptoKey): Promise<void> {
  await withStore('readwrite', (s) => s.put(key, KEY_ID))
}

export async function loadEncKey(): Promise<CryptoKey | null> {
  const v = await withStore<CryptoKey | undefined>('readonly', (s) => s.get(KEY_ID))
  return v ?? null
}

export async function clearEncKey(): Promise<void> {
  await withStore('readwrite', (s) => s.delete(KEY_ID))
}
