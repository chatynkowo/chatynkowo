/* Build the public code-validation file from the SECRET slug→code pairs.

   The site is fully static, so the 4-digit plaque codes can't be checked by
   a server. Instead the page compares a salted SHA-256 of the entered code
   against this generated lookup — the plaintext codes themselves live only
   in private/codes.json, which the deploy workflow strips from the artifact
   and which must never be published.

     Source : private/codes.json        (SECRET — slug→code pairs + salt)
     Output : data/code_hashes.json     (public — sha256(salt:code) → slug)

   Run from anywhere:  node private/build-code-hashes.mjs
   The /admin/ editor regenerates the same file in-browser when codes change;
   both use sha256(`${salt}:${code}`) hex, so keep the algorithms in sync.

   Honest limitation: 4-digit codes have only 10 000 combinations, so the
   hashes can be brute-forced offline by a determined adult. The goal here is
   only that the codes can never be read straight off the website. */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at private/, so the repo root is one level up.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(REPO_ROOT, 'private/codes.json');
const OUT = path.join(REPO_ROOT, 'data/code_hashes.json');

const { salt, codes } = JSON.parse(readFileSync(SRC, 'utf8'));
if (!salt || !Array.isArray(codes)) {
  console.error(`Malformed ${SRC}: expected { salt, codes: [{ slug, code }] }`);
  process.exit(1);
}

const entries = {};
for (const { slug, code } of codes) {
  if (!slug || !/^\d{4}$/.test(code ?? '')) {
    console.error(`Invalid entry in codes.json: ${JSON.stringify({ slug, code })}`);
    process.exit(1);
  }
  const hash = createHash('sha256').update(`${salt}:${code}`).digest('hex');
  if (entries[hash]) {
    console.error(`Duplicate code ${code} (${entries[hash]} vs ${slug})`);
    process.exit(1);
  }
  entries[hash] = slug;
}

writeFileSync(OUT, JSON.stringify({ salt, entries }, null, 2) + '\n');
console.log(`wrote ${path.relative(REPO_ROOT, OUT)} (${codes.length} codes)`);
