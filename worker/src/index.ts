/**
 * Plano de Vida — sync Worker.
 *
 * Single-user, end-to-end-encrypted state store. Holds ONE opaque encrypted
 * blob plus a monotonically increasing version number and the per-account KDF
 * salt. The Worker never sees the passphrase, the encryption key, or plaintext —
 * only ciphertext it cannot read.
 *
 * Routes:
 *   GET    /health        -> { ok: true }                    (no auth)
 *   GET    /state         -> { version, blob, salt }         (auth)
 *   GET    /state?meta=1  -> { version, blob: null, salt }   (auth, cheap version probe)
 *   PUT    /state         -> body { baseVersion, blob, salt? } (auth, optimistic concurrency)
 *   DELETE /state         -> { ok: true }                    (auth, wipes all keys)
 *
 * Auth: `Authorization: Bearer <token>` compared to the SYNC_TOKEN secret.
 * The token is PBKDF2(passphrase, fixed app salt) computed client-side — see
 * derive-token.mjs. It is NOT the encryption key (that uses a separate random salt).
 */

export interface Env {
  SYNC_KV: KVNamespace
  /** Secret: expected bearer token (base64url). Set via `wrangler secret put SYNC_TOKEN`. */
  SYNC_TOKEN: string
  /** Secret: random.org API key for GET /random. Set via `wrangler secret put RANDOM_ORG_API_KEY`. */
  RANDOM_ORG_API_KEY: string
  /** Comma-separated allowed CORS origins, e.g. "https://gabrielschutz.de,http://localhost:5173". */
  ALLOWED_ORIGINS: string
}

const KEY_BLOB = 'state:blob'
const KEY_VERSION = 'state:version'
const KEY_SALT = 'state:salt'

function pickOrigin(req: Request, env: Env): string {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (origin && allowed.includes(origin)) return origin
  return allowed[0] ?? ''
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(
  body: unknown,
  status: number,
  cors: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

/** Length-independent-ish constant-time string compare. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(req: Request, env: Env): boolean {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return Boolean(env.SYNC_TOKEN) && timingSafeEqual(token, env.SYNC_TOKEN)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = pickOrigin(req, env)
    const cors = corsHeaders(origin)
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      return json({ ok: true }, 200, cors)
    }

    if (!isAuthorized(req, env)) {
      return json({ error: 'unauthorized' }, 401, cors)
    }

    // Draw a true-random integer in [1, max] from random.org. Auth-gated above, so
    // only the owner (who holds the sync bearer token) gets random.org numbers;
    // everyone else got a 401 and the client falls back to crypto. Any failure
    // here returns 502 so the client also falls back to crypto. Used by the
    // Meditação practice (max=1055, the longest Escrivá book).
    if (url.pathname === '/random' && req.method === 'GET') {
      const maxRaw = Number(url.searchParams.get('max') ?? '1055')
      const max = Number.isFinite(maxRaw) ? Math.floor(maxRaw) : 1055
      if (max < 1 || max > 1_000_000) {
        return json({ error: 'max out of range' }, 400, cors)
      }
      try {
        const rpc = await fetch('https://api.random.org/json-rpc/4/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'generateIntegers',
            params: { apiKey: env.RANDOM_ORG_API_KEY, n: 1, min: 1, max },
            id: 1,
          }),
          // Don't hold the client request open on a hung random.org — abort and
          // return 502 so the client falls back to crypto.
          signal: AbortSignal.timeout(5000),
        })
        // random.org returns HTTP 200 even on app-level errors (failure lands in a
        // top-level `error` field with no `result`), so checking rpc.ok is not
        // enough — also require a valid integer in result.random.data[0].
        if (!rpc.ok) return json({ error: 'random.org failed' }, 502, cors)
        const data = (await rpc.json()) as {
          result?: { random?: { data?: number[] } }
        }
        const n = data.result?.random?.data?.[0]
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > max) {
          return json({ error: 'random.org failed' }, 502, cors)
        }
        return json({ n, source: 'random.org' }, 200, cors)
      } catch {
        return json({ error: 'random.org failed' }, 502, cors)
      }
    }

    if (url.pathname === '/state') {
      if (req.method === 'GET') {
        // Cheap version probe for polling/focus-pulls: skip reading the (large)
        // blob from KV and report just the version (+ salt, which is tiny).
        if (url.searchParams.get('meta') === '1') {
          const [versionStr, salt] = await Promise.all([
            env.SYNC_KV.get(KEY_VERSION),
            env.SYNC_KV.get(KEY_SALT),
          ])
          return json(
            { version: Number(versionStr ?? '0'), blob: null, salt: salt ?? null },
            200,
            cors
          )
        }
        const [blob, versionStr, salt] = await Promise.all([
          env.SYNC_KV.get(KEY_BLOB),
          env.SYNC_KV.get(KEY_VERSION),
          env.SYNC_KV.get(KEY_SALT),
        ])
        return json(
          { version: Number(versionStr ?? '0'), blob: blob ?? null, salt: salt ?? null },
          200,
          cors
        )
      }

      if (req.method === 'PUT') {
        let body: { baseVersion?: unknown; blob?: unknown; salt?: unknown }
        try {
          body = (await req.json()) as typeof body
        } catch {
          return json({ error: 'invalid json' }, 400, cors)
        }
        const { baseVersion, blob, salt } = body
        if (typeof blob !== 'string' || typeof baseVersion !== 'number') {
          return json(
            { error: 'baseVersion (number) and blob (string) are required' },
            400,
            cors
          )
        }

        // Optimistic concurrency. Read-modify-write is not atomic on KV, which is
        // acceptable for a single user who is not writing from two devices within
        // the same moment. Swap KV for a Durable Object if strict CAS is ever needed.
        const current = Number((await env.SYNC_KV.get(KEY_VERSION)) ?? '0')
        if (baseVersion !== current) {
          return json({ error: 'conflict', version: current }, 409, cors)
        }

        const next = current + 1
        const writes: Promise<unknown>[] = [
          env.SYNC_KV.put(KEY_BLOB, blob),
          env.SYNC_KV.put(KEY_VERSION, String(next)),
        ]
        // The account salt is set once on first push and never overwritten, so all
        // devices derive the same encryption key from the passphrase.
        if (typeof salt === 'string' && salt) {
          const existingSalt = await env.SYNC_KV.get(KEY_SALT)
          if (!existingSalt) writes.push(env.SYNC_KV.put(KEY_SALT, salt))
        }
        await Promise.all(writes)
        return json({ version: next }, 200, cors)
      }

      if (req.method === 'DELETE') {
        await Promise.all([
          env.SYNC_KV.delete(KEY_BLOB),
          env.SYNC_KV.delete(KEY_VERSION),
          env.SYNC_KV.delete(KEY_SALT),
        ])
        return json({ ok: true }, 200, cors)
      }
    }

    return json({ error: 'not found' }, 404, cors)
  },
}
