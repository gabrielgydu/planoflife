import type { RemoteState } from './types'

export class SyncAuthError extends Error {
  constructor() {
    super('Não autorizado — verifique a senha e a URL.')
    this.name = 'SyncAuthError'
  }
}

export class SyncConflictError extends Error {
  constructor(public version: number) {
    super(`Conflito — a nuvem está na versão ${version}.`)
    this.name = 'SyncConflictError'
  }
}

/** GET /state. Always network (no SW/HTTP cache). */
export async function fetchRemote(url: string, token: string): Promise<RemoteState> {
  const res = await fetch(`${url}/state`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 401) throw new SyncAuthError()
  if (!res.ok) throw new Error(`GET /state falhou (${res.status})`)
  return (await res.json()) as RemoteState
}

/**
 * PUT /state with optimistic concurrency. Not used by the Phase 3 read path; kept
 * here for the bootstrap/initial-seed and for Phase 4 push.
 */
export async function pushRemote(
  url: string,
  token: string,
  body: { baseVersion: number; blob: string; salt: string }
): Promise<{ version: number }> {
  const res = await fetch(`${url}/state`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  if (res.status === 401) throw new SyncAuthError()
  if (res.status === 409) {
    const j = (await res.json()) as { version: number }
    throw new SyncConflictError(j.version)
  }
  if (!res.ok) throw new Error(`PUT /state falhou (${res.status})`)
  return (await res.json()) as { version: number }
}
