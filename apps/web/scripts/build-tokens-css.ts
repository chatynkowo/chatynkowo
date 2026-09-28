/* Writes src/ui/tokens.css from @chatynkowo/theme. Runs before the dev
   server and the build (see package.json); the output is generated and
   ignored by git, like the icon sprite. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tokensCss } from '@chatynkowo/theme'

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/ui/tokens.css')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, tokensCss())
console.log('wrote src/ui/tokens.css')
