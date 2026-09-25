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

/* The authored content lives in the repository root, under the same paths
   the published site serves them at (data/, cottages/, assets/), because the
   admin editor writes those paths through the GitHub API and the mobile app
   fetches them from the site. This app only ships them. */
const repoRoot = resolve(import.meta.dirname, '../..')
const contentEntries = ['assets', 'data', 'cottages']

/* Web-only static files (legal pages, robots, sitemap, CNAME, the legacy
   stylesheet the legal pages link) sit in public/ and go through Vite's
   regular publicDir copy. */

function serveRepoContent(): Plugin {
  return {
    name: 'chatynkowo-repo-content',
    /* Dev: map /data/*, /cottages/*, /assets/* onto the repository root via
       Vite's own /@fs/ file serving (mime types and range requests for audio
       included), so the dev server sees exactly the production layout. */
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? ''
        const entry = contentEntries.find((name) => url === `/${name}` || url.startsWith(`/${name}/`))
        if (entry) req.url = `/@fs${repoRoot}${url}`
        next()
      })
    },
    /* Build: copy them next to the bundle. */
    closeBundle() {
      const outDir = resolve(import.meta.dirname, 'dist')
      mkdirSync(outDir, { recursive: true })
      for (const entry of contentEntries) {
        cpSync(resolve(repoRoot, entry), resolve(outDir, entry), { recursive: true, force: true })
      }
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [react(), serveRepoContent()],
  server: {
    fs: { allow: [repoRoot] },
  },
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
