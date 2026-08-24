import { execSync } from 'node:child_process'
import { cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

let commitHash = 'dev'
try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
} catch {
  // Building outside a git checkout (e.g. from a source tarball).
}

const staticEntries = [
  'assets',
  'data',
  'cottages',
  'legal',
  // The standalone legal pages (legal/*.html) are plain HTML that links
  // ../style.css, so the old stylesheet must ship alongside them.
  'style.css',
  'CNAME',
  'robots.txt',
  'sitemap.xml',
]

function copyStaticSite(): Plugin {
  return {
    name: 'copy-chatynkowo-static-files',
    closeBundle() {
      const outDir = resolve(import.meta.dirname, 'dist')
      mkdirSync(outDir, { recursive: true })
      for (const entry of staticEntries) {
        cpSync(resolve(import.meta.dirname, entry), resolve(outDir, entry), {
          recursive: true,
          force: true,
        })
      }
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [react(), copyStaticSite()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ranking: resolve(import.meta.dirname, 'ranking.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
})
