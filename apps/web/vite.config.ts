import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

let commitHash = 'dev'
try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
} catch {
  // Building outside a git checkout (e.g. from a source tarball).
}

/* The authored content is the @chatynkowo/content package: its public/
   directory holds the tree the site publishes at the same paths (data/,
   cottages/, assets/), which the admin editor writes through the GitHub
   API and the mobile app fetches from the site. This app only ships it. */
const contentRoot = resolve(dirname(createRequire(import.meta.url).resolve('@chatynkowo/content/package.json')), 'public')
const contentEntries = ['assets', 'data', 'cottages']

/* Web-only static files (legal pages, robots, sitemap, CNAME, the legacy
   stylesheet the legal pages link, and the site's own chrome under
   assets/: the fonts and the background) sit in public/ and go through
   Vite's regular publicDir handling. Keeping the chrome there matters:
   Vite rewrites a stylesheet's url() to a public file so it follows the
   relative base, while a url() into the content tree stays absolute and
   breaks on a deploy under a path (a project page). The two trees meet in
   dist/assets. */

function serveRepoContent(): Plugin {
  return {
    name: 'chatynkowo-repo-content',
    /* Dev: map /data/*, /cottages/*, /assets/* onto the package via Vite's
       own /@fs/ file serving (mime types and range requests for audio
       included), so the dev server sees exactly the production layout. */
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? ''
        const entry = contentEntries.find((name) => url === `/${name}` || url.startsWith(`/${name}/`))
        /* A file the site's public/ holds at the same path (the fonts) is
           Vite's to serve. */
        if (entry && !existsSync(resolve(import.meta.dirname, 'public', `.${url.split('?')[0]}`))) req.url = `/@fs${contentRoot}${url}`
        next()
      })
    },
    /* Build: copy them next to the bundle, merging with what publicDir put
       under dist/assets already. */
    closeBundle() {
      const outDir = resolve(import.meta.dirname, 'dist')
      mkdirSync(outDir, { recursive: true })
      for (const entry of contentEntries) {
        cpSync(resolve(contentRoot, entry), resolve(outDir, entry), { recursive: true, force: true })
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
    fs: { allow: [contentRoot, resolve(import.meta.dirname, '../..')] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ranking: resolve(import.meta.dirname, 'ranking.html'),
        profile: resolve(import.meta.dirname, 'profile.html'),
        deleteAccount: resolve(import.meta.dirname, 'delete-account.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
})
