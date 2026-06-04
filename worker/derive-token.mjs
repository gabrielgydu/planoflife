#!/usr/bin/env node
/**
 * Derives the SYNC_TOKEN (the Worker's bearer secret) from your passphrase.
 *
 * The token is PBKDF2(passphrase, fixed app salt). It gates access to the Worker
 * and is NOT the encryption key — that uses a separate, random per-account salt,
 * so the token never reveals anything about your encrypted data.
 *
 * Usage:
 *   node derive-token.mjs                 # prompts (hidden input)
 *   SYNC_PASSPHRASE='...' node derive-token.mjs
 *
 * These constants MUST stay identical to the client (src/sync/syncCrypto.ts) and
 * the CLI (scripts/sync.mjs). They define the canonical auth-token derivation.
 */
import { webcrypto as crypto } from 'node:crypto'

// --- canonical AUTH derivation constants (keep in sync everywhere) ---
const AUTH_SALT = new TextEncoder().encode('planoflife-sync/auth/v1')
const AUTH_ITERATIONS = 310_000
const AUTH_BITS = 256
// ---------------------------------------------------------------------

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function deriveAuthToken(passphrase) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: AUTH_SALT, iterations: AUTH_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    AUTH_BITS
  )
  return base64url(bits)
}

const CODE_ENTER_LF = 10 // \n
const CODE_ENTER_CR = 13 // \r
const CODE_EOT = 4 // Ctrl-D
const CODE_ETX = 3 // Ctrl-C
const CODE_BACKSPACE = 8 // \b
const CODE_DEL = 127 // backspace key on most terminals

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stdout
    if (!stdin.isTTY) {
      reject(new Error('No TTY. Pass the passphrase via SYNC_PASSPHRASE env var instead.'))
      return
    }
    stdout.write(question)
    stdin.resume()
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    let input = ''
    const onData = (char) => {
      const code = char.charCodeAt(0)
      if (code === CODE_ENTER_LF || code === CODE_ENTER_CR || code === CODE_EOT) {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        stdout.write('\n')
        resolve(input)
      } else if (code === CODE_ETX) {
        stdout.write('\n')
        process.exit(1)
      } else if (code === CODE_BACKSPACE || code === CODE_DEL) {
        input = input.slice(0, -1)
      } else {
        input += char
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const passphrase = process.env.SYNC_PASSPHRASE ?? (await promptHidden('Passphrase: '))
  if (!passphrase) {
    console.error('Empty passphrase.')
    process.exit(1)
  }
  const token = await deriveAuthToken(passphrase)
  console.log(token)
  if (process.stdout.isTTY) {
    console.error('\nPaste the line above into:  npx wrangler secret put SYNC_TOKEN')
  }
}

// Run only when invoked directly (so the CLI can import deriveAuthToken).
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
