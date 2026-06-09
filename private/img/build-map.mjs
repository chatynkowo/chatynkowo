/* Build the published symbolic map from the *pin-less* base orig.

   The page renders cottage pins itself, as a data-driven overlay: main.js
   drawCottages() places one interactive pin per entry in data/cottages.json
   at its mapX/mapY (assets/img/map-pin.svg, blue map-pin-found.svg once found).

   Therefore the published background MUST stay pin-less. If pins are ever
   painted into the background image, every one of them becomes a "dead pin" —
   not clickable, not tied to a cottage, and frozen in place while the real
   pins move. Never point this script at a pinned source
   (e.g. map_base_vertical-pins.png).

     Source : private/img/origs/map_base_vertical.png  (1024x1536, no pins)
     Output : assets/img/map_base_vertical.webp         (~627 KB at quality 90)

   Run from anywhere:  node private/img/build-map.mjs

   Zero npm dependencies — it shells out to `cwebp`, the canonical libwebp
   encoder (same engine browsers and ImageMagick use). Install it with your
   system package manager if missing:

     apt:      sudo apt-get install webp
     macOS:    brew install webp

   quality=90 / method=6 matches the visual quality and ~630 KB size of the
   previously published asset. */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at private/img/, so the repo root is two levels up.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(REPO_ROOT, 'private/img/origs/map_base_vertical.png');
const OUT = path.join(REPO_ROOT, 'assets/img/map_base_vertical.webp');

if (!existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}

const res = spawnSync('cwebp', ['-q', '90', '-m', '6', SRC, '-o', OUT], {
  stdio: ['ignore', 'inherit', 'inherit'],
});

if (res.error && res.error.code === 'ENOENT') {
  console.error('`cwebp` not found on PATH. Install libwebp: `sudo apt-get install webp` or `brew install webp`.');
  process.exit(1);
}
if (res.status !== 0) process.exit(res.status ?? 1);

console.log(`wrote ${path.relative(REPO_ROOT, OUT)}`);
