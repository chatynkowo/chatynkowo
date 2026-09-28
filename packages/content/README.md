# @chatynkowo/content

The authored content of Chatynkowo as a workspace package, so that every
client and tool reads it from one place.

```
public/      the tree the site publishes as is, under the same paths
  cottages/  stories (markdown), translations in cottages/<code>/
  data/      cottages.json, rewards.json (+ rewards.<code>.json), code_hashes.json
  assets/    recordings (stories/<code>/), images (img/), fonts (fonts/)
private/     never published: codes.json (the secret plaque codes) and image originals
scripts/     build-code-hashes.ts — derives public/data/code_hashes.json from private/codes.json
```

## Who reads it

- **The site** (`apps/web`): the plugin in `vite.config.ts` serves `public/`
  in development and copies it into `dist/` on build, so the published URLs
  (`data/cottages.json`, `cottages/<slug>.md`, `assets/...`) are exactly the
  paths under `public/`. `private/` is never copied.
- **The mobile app** (`apps/mobile`): fetches the same published paths from
  the site origin through the content client of `@chatynkowo/core`; it does
  not bundle this package.
- **The `/admin/` editor**: writes the files through the GitHub API. Inside
  the editor every path is the published one (or `private/codes.json`); the
  translation to `packages/content/public/...` and `packages/content/private/...`
  happens at the API boundary (`toRepo` / `toLocal` in
  `apps/web/admin/editor.ts`).
- **Tools**: `pnpm codes:build` rewrites the public code-hash lookup from
  the secret codes, `pnpm codes:check` fails when the committed lookup does
  not match them (the deploy workflow runs the check). The hashing comes
  from `@chatynkowo/core`, the same functions the clients validate codes
  with.

The published paths are listed in one place, `CONTENT_PATHS` in
`packages/core/src/content.ts`; `public/` mirrors that layout.

## Importing files

Anything under `public/` can be imported by a bundler through the
`./public/*` entry, for example `@chatynkowo/content/public/assets/img/logo.webp`,
when an app needs to ship a file instead of fetching it. Import single
files, never the directory: the package has no index, so a bundle contains
only what is named.

## Adding content

Use the `/admin/` editor; it keeps `data/cottages.json`, `private/codes.json`
and `data/code_hashes.json` consistent. After a hand edit of
`private/codes.json`, run `pnpm codes:build` from the repository root and
commit the regenerated `public/data/code_hashes.json`.
