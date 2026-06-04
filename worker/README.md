# Plano de Vida — sync Worker

A tiny single-user, end-to-end-encrypted state store on Cloudflare Workers + KV.
It holds one **encrypted** blob, a version number, and the account KDF salt. It
never sees your passphrase, encryption key, or plaintext.

## Routes

| Method | Path      | Auth | Purpose |
|--------|-----------|------|---------|
| GET    | `/health` | no   | liveness check |
| GET    | `/state`  | yes  | `{ version, blob, salt }` |
| PUT    | `/state`  | yes  | body `{ baseVersion, blob, salt? }` — stores if `baseVersion` matches, else `409` |
| DELETE | `/state`  | yes  | wipes all keys (reset) |

Auth header: `Authorization: Bearer <token>`, where `<token>` = `derive-token.mjs`.

## One-time deploy

```bash
cd worker
npm install

# 1. Log in (opens a browser). Free Cloudflare account works.
npx wrangler login

# 2. Create the KV namespace, then paste the printed id into wrangler.toml.
npx wrangler kv namespace create SYNC_KV

# 3. Derive the bearer token from your passphrase and store it as a secret.
node derive-token.mjs                 # enter your passphrase -> prints a token
npx wrangler secret put SYNC_TOKEN    # paste the token

# 4. Deploy. Note the printed URL: https://planoflife-sync.<your-subdomain>.workers.dev
npx wrangler deploy
```

## Verify (writes test data — clean it before seeding real data)

```bash
URL=https://planoflife-sync.<your-subdomain>.workers.dev
TOKEN=$(SYNC_PASSPHRASE='your-passphrase' node derive-token.mjs)

curl -s $URL/health                                            # {"ok":true}
curl -s $URL/state                                             # 401 (no token)
curl -s $URL/state -H "Authorization: Bearer $TOKEN"           # {"version":0,"blob":null,"salt":null}
curl -s -X PUT $URL/state -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"baseVersion":0,"blob":"test","salt":"dGVzdHNhbHQ="}'   # {"version":1}
curl -s -X PUT $URL/state -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"baseVersion":0,"blob":"stale","salt":"x"}'             # 409 conflict

# Clean test data so the real (random) salt can be stored on first real push:
curl -s -X DELETE $URL/state -H "Authorization: Bearer $TOKEN" # {"ok":true}
```

## Local development (no Cloudflare account needed)

```bash
echo 'SYNC_TOKEN=devtoken' > .dev.vars     # gitignored
npx wrangler dev                           # serves on http://localhost:8787 with a local KV
```

## Notes

- KV read-modify-write is not strictly atomic; fine for a single user. For strict
  compare-and-swap (and free realtime push), swap KV for a Durable Object later.
- To allow a custom origin or a second device origin, edit `ALLOWED_ORIGINS` in
  `wrangler.toml` and redeploy.
