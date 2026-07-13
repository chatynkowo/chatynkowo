import { cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const staticEntries = [
  'assets',
  'data',
  'cottages',
  'legal',
  'admin',
  'CNAME',
  'ranking.html',
  'ranking.css',
  'ranking.js',
  'app_logic.js',
  'analytics.js',
  'chatynkowo-sync.js',
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
  plugins: [react(), copyStaticSite()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
