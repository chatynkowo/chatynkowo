# Chatynkowo

The Chatynkowo monorepo: the web site (React + TypeScript + Vite), shared
domain and backend packages, and a place for the mobile app (React Native).
The game content lives in the repository root under the same paths the site
publishes it at.

## Repository layout

```
apps/
  web/         web site and the /admin/ editor  (Vite, React)
  mobile/      mobile app — to be bootstrapped, see apps/mobile/README.md
packages/
  core/        @chatynkowo/core  — types, languages, content client, rewards, progress, geography, plaque codes
  api/         @chatynkowo/api   — client for the shared backend (Supabase): accounts, profiles, finds, leaderboard
  i18n/        @chatynkowo/i18n  — interface dictionaries (pl, en)
supabase/      backend schema as migrations + README
cottages/      stories (markdown), translations in cottages/<code>/
data/          cottages.json, rewards.json, code_hashes.json
assets/        recordings (stories/), images (img/)
private/       secret plaque codes + the script that builds the public hashes
```

Dependencies between packages go one way: `core` depends on nothing, `i18n`
and `api` depend on `core`, the apps depend on the packages. Packages are
published as TypeScript sources (`main: src/index.ts`) — Vite and Metro
compile them together with the app, with no separate build step. `core`,
`api` and `i18n` are type-checked without the `DOM` library so that nothing in
them assumes a browser: `fetch` and SHA-256 come in through adapters
(`packages/core/src/platform.ts`).

## Running

```bash
pnpm install
pnpm dev          # web site: http://localhost:5173
pnpm check        # type-check every package
pnpm build        # apps/web/dist
pnpm codes:build  # public code hashes from private/codes.json
```

The site's configuration (Supabase URL, publishable key, content origin) is
in `apps/web/src/config.ts` and is overridden by `apps/web/.env` (template:
`apps/web/.env.example`). Without the file the site uses the production
Supabase project.

## Site entry points (`apps/web`)

- `/` — the game and the Chatynkowo Atlas (`src/main.tsx`),
- `/ranking.html` — the players' leaderboard (`src/ranking-main.tsx`),
- `/admin/` — the content and location editor (`admin/editor.ts`).

Vite builds all entry points in one process. In development the plugin in
`vite.config.ts` serves `data/`, `cottages/` and `assets/` from the repository
root, and on build copies them into `dist/`; web-only files (`legal/`,
`robots.txt`, `sitemap.xml`, `CNAME`, the legacy `style.css` for the legal
pages) live in `apps/web/public/`.

## Backend

The shared backend is a Supabase project: Google sign-in, the `profiles` and
`finds` tables, the `leaderboard()` function. The schema is in
`supabase/migrations/`, the client code in `packages/api`, the description
and procedures in `supabase/README.md`. The database holds per-user data
only; content is published statically and read through the content client
in `@chatynkowo/core`.

## Data layout

- `data/cottages.json` — public cottage locations (`slug`, `lat`, `lng`) and the photo list (`photos`),
- `cottages/*.md` — story content and frontmatter,
- `private/codes.json` — the secret plaque codes,
- `data/code_hashes.json` — the public index of salted code hashes,
- `data/rewards.json` — the Kronika: title, intro and reward levels (`id`, `name`, `threshold` or `final`, `image`, `body`),
- `assets/stories/<code>/*.mp3` — story recordings, one directory per language (`pl/` holds the originals),
- `assets/img/cottages/<slug>/` — cottage photos,
- `assets/img/rewards/<id>/` — reward card illustrations.

Static hosting offers no directory listing, so `photos` in `data/cottages.json` is the only source of truth for which photos exist and in what order to show them. Without photos the site shows a shared illustration.

Rewards are fully data-driven: thresholds, texts and images come from `data/rewards.json`. `packages/core/src/rewards.ts` holds only the fallback set used when the file cannot be loaded — the level ids are the same in both places so that earned progress matches whichever source is in effect.

The paths of these files are gathered in one place (`CONTENT_PATHS` in `packages/core/src/content.ts`), and the content client `createContentClient({ baseUrl })` reads them from anywhere: the site from its own origin, the mobile app from `https://www.chatynkowo.pl`.

## Languages (i18n)

The interface is translated with i18next, the content through files parallel to the Polish originals. Polish is the source language and the final fallback; on the site the user's choice goes to `localStorage`, and without one the browser language decides.

Division of responsibility:

- `packages/core/src/languages.ts` — the single registry of languages (code + native name), shared by the site, the `/admin/` editor, the content client and the mobile app,
- `packages/i18n/src/<code>.ts` — the interface dictionary (every UI string, including ARIA attributes and page meta), registered in `DICTIONARIES` in `packages/i18n/src/index.ts`,
- `apps/web/src/i18n/index.ts` — the site's i18next instance (browser language detection); the mobile app creates its own from the same dictionaries,
- `cottages/<code>/<slug>.md` — a story translation; a missing file falls back automatically to the Polish original `cottages/<slug>.md`,
- `data/rewards.<code>.json` — the Kronika and reward card translation; a missing file falls back to `data/rewards.json`,
- `assets/stories/<code>/<slug>.mp3` — the story recording in that language; a missing file makes the player switch to the Polish original `assets/stories/pl/<slug>.mp3`,
- `apps/web/public/legal/` — the legal pages are separate documents per language; their URLs come from the `footer.termsHref` / `footer.privacyHref` keys in the dictionary.

To add a language: add an entry in `languages.ts`, copy `pl.ts`, translate the dictionary and register it in `DICTIONARIES` (a missing entry fails compilation) — that is enough for the language to appear in the selectors with a complete interface. Content (`cottages/<code>/`, `data/rewards.<code>.json`) is translated conveniently in `/admin/` and can be filled in gradually; until then players see the Polish originals. The story parser recognises the "on site" section heading by its exact wording — add the new language's variant to `ARRIVAL_HEADINGS` in `packages/core/src/content.ts`.

Translations in the editor: the language selector in the `/admin/` bar switches both categories into translation mode. The forms then edit the parallel files (`cottages/<code>/<slug>.md`, `data/rewards.<code>.json`), and the fields shared across languages (plaque code, map pin, photos, thresholds, order and reward images) are hidden — they belong to the Polish original and are carried over to that file automatically when a reward translation is saved. The audio section stays active: in translation mode it uploads and removes the recording for that language (`assets/stories/<code>/<slug>.mp3`), and until one exists the site plays the Polish original. A cottage without a translation is marked in the list ("no translation"), and the form suggests the Polish original as a starting point. After editing a Polish original the translation does not update itself — refresh it in this mode.

## Admin panel (content editor)

The panel writes changes straight into the repository through the GitHub API, under repository-root paths (`cottages/`, `data/`, `assets/`, `private/`). The PAT token is stored only in the browser's `localStorage`. Publishing several changed files happens in a single commit.

Files shared by all cottages (`data/cottages.json`, `private/codes.json` together with `data/code_hashes.json`) are not written from the copy held in the tab's memory: on every save the panel reads their current version from the branch and applies its change on top, so a tab left open for a long time never overwrites entries added from another device in the meantime. A save that would remove anything from these files other than the cottage being deliberately deleted is held back with a message. A tab returning from the background after a longer pause refreshes its data on its own, unless there are unsaved changes.

The bar at the top switches between two categories:

- **Cottages** — name, resident, virtue, plaque code, map pin (`lat`/`lng`), recording, photos and the story text. Everything before the heading `## Co zrobić, gdy trafisz pod chatynkę?` unlocks only after the code is entered; the section below is public and appears in the cottage panel on the map.
- **Rewards** — the Kronika intro and the reward levels: name, threshold (or the final-reward marker for the full set), illustration and a markdown description. Levels can be added, removed and reordered, and the preview next to them shows the finished card. The final reward unlocks the leaderboard invitation, so its id is read from the file — it can be renamed freely.

Each category has its own "unsaved" state; switching tabs with unsaved work asks whether to save, discard or stay.

The editor's own interface copy is Polish, for the Polish content team; that is a product choice, not a code convention.

## Interface conventions

The web app has one shared interface layer, `apps/web/src/ui`, and every
page and feature component builds on it instead of re-implementing pieces:

- `ui.css` — design tokens (`:root`) and the primitives: buttons, icon
  buttons, modal dialogs. Each entry point imports it first; page stylesheets
  extend these rules and never redefine them.
- `icons.ts` — the icon vocabulary. Phosphor is the only icon library and
  this is the only module that imports it; components use the semantic names
  (`CloseIcon`, `ChronicleIcon`, …) and the `iconSize` scale. Swapping a
  glyph or the library is a change in one file.
- `Button`, `LinkButton`, `IconButton` — the three button contracts
  (`primary`, `ghost`, `subtle`; icon-only controls require a label).
- `Modal` with `useModalLayer` — one dialog for the whole site: backdrop,
  card, close control, Escape on the topmost layer only, page lock and inert
  background, focus into the dialog and back to the opener. Mount it only
  while open and give the card a page-specific class for its look.
- Specialised controls (map toolbar, audio transport, the Kronika toggle)
  keep their own styles but take their icons from the vocabulary.

Markup that React does not render, i.e. the legal pages and the admin
editor, uses the same Phosphor glyphs through an SVG sprite:
`apps/web/scripts/build-icon-sprite.mjs` generates `public/icons.svg` from
`@phosphor-icons/core` for the names listed in `src/ui/sprite-icons.json`.
It runs before `vite` in the dev and build scripts (`pnpm icons:build` runs
it alone); the output is generated and ignored by git.

Never use emoji or typographic symbols (arrows, crosses, ticks, bullets) as
icons, in markup, in CSS `content` or in source comments.
`scripts/check-conventions.mjs`, part of `pnpm check`, fails on any such
glyph and on icon-library imports outside the two modules above.

The admin editor keeps its own light-themed `.btn` styles on purpose: it is
an internal tool with a different look, not a page of the site.

The mobile app should mirror the icon vocabulary with `phosphor-react-native`
under the same semantic names, so that design decisions stay in one place.

## Deployment

GitHub Actions (`.github/workflows/pages.yml`): `pnpm install`, `pnpm codes:build`, `pnpm check`, `pnpm build`, then `apps/web/dist` is published to GitHub Pages. The `private/` directory never reaches the artifact.
