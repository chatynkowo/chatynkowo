/* Repository conventions that a type checker cannot enforce. Runs as part of
   `pnpm check` and fails on the first class of violation it finds:

   1. No emoji or symbol glyphs used as icons anywhere in source, markup,
      styles or docs: arrows, crosses, ticks, bullets, stars, pictographs.
      Icons come from the Phosphor vocabulary (apps/web/src/ui/icons.ts) or
      the generated SVG sprite. Typographic punctuation (dashes, quotes,
      ellipsis, middle dot) is fine.
   2. @phosphor-icons/react is imported only by the icon vocabulary module,
      and @phosphor-icons/core only by the sprite generator.

   Authored content (cottages/, data/, assets/) is not checked: it is data,
   not code. */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_ROOTS = ['apps', 'packages', 'supabase', 'scripts', 'private', 'Readme.md', '.github']
/* Only code can import a library; manifests and docs may name it. */
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.json', '.sql', '.md', '.yml', '.yaml'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.expo', 'build', 'origs'])
/* Generated files and third-party assets are not ours to police. */
const SKIP_FILES = new Set(['apps/web/public/icons.svg', 'pnpm-lock.yaml'])

/* Arrows, technical and geometric symbols, dingbats, miscellaneous symbols
   and pictographs, emoji (including the supplementary planes), plus the
   multiplication sign and the bullet, which get used as a close mark and a
   list icon. */
const GLYPH = /[\u00D7\u2022\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF\u2900-\u297F\u2B00-\u2BFF\u{1F000}-\u{1FAFF}\uFE0F]/u

/* Module specifiers, i.e. the quoted package name — prose mentions in
   comments and docs are fine. */
const ICON_LIBRARY_RULES = [
  { pattern: /['"]@phosphor-icons\/react['"]/, allowed: ['apps/web/src/ui/icons.ts'], hint: 'import icons from the vocabulary in apps/web/src/ui/icons.ts' },
  { pattern: /['"]@phosphor-icons\/core['"]/, allowed: ['apps/web/scripts/build-icon-sprite.mjs'], hint: 'static markup uses the sprite built by apps/web/scripts/build-icon-sprite.mjs' },
]

function* walk(path) {
  const stats = statSync(path)
  if (stats.isFile()) {
    yield path
    return
  }
  for (const entry of readdirSync(path)) {
    if (SKIP_DIRS.has(entry)) continue
    yield* walk(join(path, entry))
  }
}

const problems = []

for (const root of SCAN_ROOTS) {
  const absolute = resolve(repoRoot, root)
  let files
  try {
    files = [...walk(absolute)]
  } catch {
    continue // A root that does not exist yet (e.g. apps/mobile before bootstrap).
  }
  for (const file of files) {
    const rel = relative(repoRoot, file).replaceAll('\\', '/')
    const extension = rel.slice(rel.lastIndexOf('.'))
    if (!SCAN_EXTENSIONS.has(extension) || SKIP_FILES.has(rel)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const glyph = line.match(GLYPH)
      if (glyph) problems.push(`${rel}:${index + 1}: glyph "${glyph[0]}" used in source — use an icon from the vocabulary or plain text`)
      if (!CODE_EXTENSIONS.has(extension)) return
      for (const rule of ICON_LIBRARY_RULES) {
        if (rule.pattern.test(line) && !rule.allowed.includes(rel)) {
          problems.push(`${rel}:${index + 1}: direct icon-library import — ${rule.hint}`)
        }
      }
    })
  }
}

if (problems.length) {
  console.error(`check-conventions: ${problems.length} problem(s)\n` + problems.map((problem) => `  ${problem}`).join('\n'))
  process.exit(1)
}
console.log('check-conventions: ok')
