/* The public code-validation file, built from the SECRET slug->code pairs.

   The site is fully static, so the 4-digit plaque codes can't be checked by
   a server. Instead the clients compare a salted SHA-256 of the entered code
   against this generated lookup — the plaintext codes themselves live only
   in private/codes.json, which the deploy workflow strips from the artifact
   and which must never be published.

     Source : private/codes.json              (SECRET — slug->code pairs + salt)
     Output : public/data/code_hashes.json    (public — sha256(salt:code) -> slug)
   both inside this package.

   Run from the repository root (or from packages/content):
     pnpm codes:build   rewrite public/data/code_hashes.json from private/codes.json
     pnpm codes:check   fail when the committed file does not match the codes
                        (the deploy workflow runs this before every build)

   The /admin/ editor regenerates the same file in-browser whenever a code
   changes, so in the normal flow the two files are committed together and
   the check passes; this script is the way to rebuild them outside the
   browser (a hand-edited codes.json, a rotated salt). The hashing itself
   (`hashCode`) and the code pattern (`isValidCode`) come from
   @chatynkowo/core, so there is one implementation to keep in sync with
   the editor's in-browser copy.

   Honest limitation: 4-digit codes have only 10 000 combinations, so the
   hashes can be brute-forced offline by a determined adult. The goal here is
   only that the codes can never be read straight off the website. */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashCode, isValidCode, webCryptoSha256Hex, type CodeLookup } from '@chatynkowo/core'

type CodesFile = { salt: string; codes: Array<{ slug: string; code: string }> }

// This file lives in scripts/, so the package root is one level up.
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(PACKAGE_ROOT, 'private/codes.json')
const OUTPUT = path.join(PACKAGE_ROOT, 'public/data/code_hashes.json')
const checkOnly = process.argv.includes('--check')

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const parsed = JSON.parse(readFileSync(SOURCE, 'utf8')) as Partial<CodesFile>
if (!parsed.salt || !Array.isArray(parsed.codes)) {
  fail(`Malformed ${SOURCE}: expected { salt, codes: [{ slug, code }] }`)
}
const { salt, codes } = parsed as CodesFile

const entries: CodeLookup['entries'] = {}
for (const { slug, code } of codes) {
  if (!slug || !isValidCode(code ?? '')) fail(`Invalid entry in codes.json: ${JSON.stringify({ slug, code })}`)
  const hash = await hashCode(salt, code, webCryptoSha256Hex)
  if (entries[hash]) fail(`Duplicate code ${code} (${entries[hash]} vs ${slug})`)
  entries[hash] = slug
}
const lookup: CodeLookup = { salt, entries }

/* Order-insensitive: the editor and this script may list entries differently. */
function sameLookup(a: CodeLookup, b: CodeLookup) {
  const keysA = Object.keys(a.entries)
  const keysB = Object.keys(b.entries)
  return a.salt === b.salt && keysA.length === keysB.length && keysA.every((hash) => a.entries[hash] === b.entries[hash])
}

if (checkOnly) {
  let committed: CodeLookup | null = null
  try {
    committed = JSON.parse(readFileSync(OUTPUT, 'utf8')) as CodeLookup
  } catch {
    committed = null
  }
  if (!committed || !sameLookup(committed, lookup)) {
    fail(`${path.relative(PACKAGE_ROOT, OUTPUT)} does not match private/codes.json — run "pnpm codes:build" and commit the result.`)
  }
  console.log(`${path.relative(PACKAGE_ROOT, OUTPUT)} matches private/codes.json (${codes.length} codes)`)
} else {
  writeFileSync(OUTPUT, JSON.stringify(lookup, null, 2) + '\n')
  console.log(`wrote ${path.relative(PACKAGE_ROOT, OUTPUT)} (${codes.length} codes)`)
}
