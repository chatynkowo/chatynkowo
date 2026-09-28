# Chatynkowo

The Chatynkowo monorepo: the web site (React + TypeScript + Vite), the
mobile app (Expo, React Native), the shared domain and backend packages, and
the game content as a package of its own.

## Repository layout

```
apps/
  web/         web site and the /admin/ editor  (Vite, React)
  mobile/      mobile app (Expo, React Native, expo-router), see apps/mobile/README.md
packages/
  core/        @chatynkowo/core     — types, languages, content client, rewards, progress, geography, plaque codes
  api/         @chatynkowo/api      — client for the shared backend (Supabase): accounts, profiles, finds, leaderboard
  i18n/        @chatynkowo/i18n     — interface dictionaries (pl, en): shared, web-only, mobile-only
  theme/       @chatynkowo/theme    — design tokens, map palette, button variants and icon role names shared by both clients
  content/     @chatynkowo/content  — the authored content, see packages/content/README.md
    public/    the tree the site publishes as is: cottages/ (stories), data/ (manifests), assets/ (recordings, images)
    private/   the secret plaque codes and image originals; never published
    scripts/   the public code-hash lookup builder
supabase/      backend description (README); the schema itself is not versioned here
scripts/       repository-wide checks (conventions)
```

Dependencies between packages go one way: `core` and `theme` depend on
nothing, `i18n`, `api` and `content` depend on `core`, the apps depend on
the packages.
Packages are published as TypeScript sources (`main: src/index.ts`) — Vite
and Metro compile them together with the app, with no separate build step.
`core`, `api` and `i18n` are type-checked without the `DOM` library so that
nothing in them assumes a browser: `fetch` and SHA-256 come in through
adapters (`packages/core/src/platform.ts`). Every package sets
`sideEffects: false` and, where a client needs only part of it, exposes an
entry point per client (`@chatynkowo/i18n/web`, `@chatynkowo/i18n/mobile`),
so bundlers ship only what each app imports.

## Running

```bash
pnpm install
pnpm dev          # web site: http://localhost:5173
pnpm check        # type-check every package and the app, plus the conventions script
pnpm build        # apps/web/dist
pnpm codes:build  # public code hashes from packages/content/private/codes.json
pnpm codes:check  # fail when the committed hashes do not match the codes
```

The mobile app runs from its own directory (`cd apps/mobile && npx expo
run:android`); see `apps/mobile/README.md` for the device setup, the JS
bundle check and the structure.

The site's configuration (Supabase URL, publishable key, content origin) is
in `apps/web/src/config.ts` and is overridden by `apps/web/.env` (template:
`apps/web/.env.example`). Without the file the site uses the production
Supabase project.

## Site entry points (`apps/web`)

- `/` — the game and the Chatynkowo Atlas (`src/main.tsx`),
- `/ranking.html` — the players' leaderboard (`src/ranking-main.tsx`),
- `/admin/` — the content and location editor (`admin/editor.ts`).

Vite builds all entry points in one process. In development the plugin in
`vite.config.ts` serves `data/`, `cottages/` and `assets/` from
`packages/content/public`, and on build copies them into `dist/`; web-only
files (`legal/`, `robots.txt`, `sitemap.xml`, `CNAME`, the legacy `style.css`
for the legal pages) live in `apps/web/public/`.

## Backend

The shared backend is a Supabase project: Google sign-in, the `profiles` and
`finds` tables, the `leaderboard()` function. The schema lives in the
Supabase project itself (migration dumps are ignored by git), the client
code in `packages/api`, the description and procedures in
`supabase/README.md`. The database holds per-user data
only; content is published statically and read through the content client
in `@chatynkowo/core`.

## Content layout (`packages/content`)

Paths below are the published ones; in the repository they sit under
`packages/content/public/`, except `private/`, which is
`packages/content/private/`.

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
- `packages/i18n/src/shared/<code>.ts`, `web/<code>.ts`, `mobile/<code>.ts` — the interface dictionaries (every UI string, including ARIA attributes and page meta): the set both clients use (the expedition loop, the lore and guide sections, the legal links), the site-only set (page meta, the gallery) and the app-only set, registered in `packages/i18n/src/index.ts`, which also builds each client's i18next resources,
- `apps/web/src/i18n/index.ts` — the site's i18next instance (browser language detection); the mobile app creates its own from the same dictionaries,
- `cottages/<code>/<slug>.md` — a story translation; a missing file falls back automatically to the Polish original `cottages/<slug>.md`,
- `data/rewards.<code>.json` — the Kronika and reward card translation; a missing file falls back to `data/rewards.json`,
- `assets/stories/<code>/<slug>.mp3` — the story recording in that language; a missing file makes the player switch to the Polish original `assets/stories/pl/<slug>.mp3`,
- `apps/web/public/legal/` — the legal pages are separate documents per language; their URLs come from the `footer.termsHref` / `footer.privacyHref` keys in the dictionary.

To add a language: add an entry in `languages.ts`, copy the `pl.ts` of `shared/`, `web/` and `mobile/`, translate them and register them in `packages/i18n/src/index.ts` (a missing entry fails compilation) — that is enough for the language to appear in the selectors with a complete interface. Content (`cottages/<code>/`, `data/rewards.<code>.json`) is translated conveniently in `/admin/` and can be filled in gradually; until then players see the Polish originals. The story parser recognises the "on site" section heading by its exact wording — add the new language's variant to `ARRIVAL_HEADINGS` in `packages/core/src/content.ts`.

Translations in the editor: the language selector in the `/admin/` bar switches both categories into translation mode. The forms then edit the parallel files (`cottages/<code>/<slug>.md`, `data/rewards.<code>.json`), and the fields shared across languages (plaque code, map pin, photos, thresholds, order and reward images) are hidden — they belong to the Polish original and are carried over to that file automatically when a reward translation is saved. The audio section stays active: in translation mode it uploads and removes the recording for that language (`assets/stories/<code>/<slug>.mp3`), and until one exists the site plays the Polish original. A cottage without a translation is marked in the list ("no translation"), and the form suggests the Polish original as a starting point. After editing a Polish original the translation does not update itself — refresh it in this mode.

## Admin panel (content editor)

The panel writes changes straight into the repository through the GitHub API, into `packages/content` (`public/cottages/`, `public/data/`, `public/assets/`, `private/`); inside the editor every path is the published one and the translation happens at the API boundary. The PAT token is stored only in the browser's `localStorage`. Publishing several changed files happens in a single commit.

Files shared by all cottages (`data/cottages.json`, `private/codes.json` together with `data/code_hashes.json`) are not written from the copy held in the tab's memory: on every save the panel reads their current version from the branch and applies its change on top, so a tab left open for a long time never overwrites entries added from another device in the meantime. A save that would remove anything from these files other than the cottage being deliberately deleted is held back with a message. A tab returning from the background after a longer pause refreshes its data on its own, unless there are unsaved changes.

The bar at the top switches between two categories:

- **Cottages** — name, resident, virtue, plaque code, map pin (`lat`/`lng`), recording, photos and the story text. Everything before the heading `## Co zrobić, gdy trafisz pod chatynkę?` unlocks only after the code is entered; the section below is public and appears in the cottage panel on the map.
- **Rewards** — the Kronika intro and the reward levels: name, threshold (or the final-reward marker for the full set), illustration and a markdown description. Levels can be added, removed and reordered, and the preview next to them shows the finished card. The final reward unlocks the leaderboard invitation, so its id is read from the file — it can be renamed freely.

Each category has its own "unsaved" state; switching tabs with unsaved work asks whether to save, discard or stay.

The editor's own interface copy is Polish, for the Polish content team; that is a product choice, not a code convention.

## Interface conventions

The web app has one shared interface layer, `apps/web/src/ui`, and every
page and feature component builds on it instead of re-implementing pieces:

- `ui.css` — the primitives: buttons, icon buttons, modal dialogs. Each
  entry point imports it first; page stylesheets extend these rules and
  never redefine them. The design tokens it starts with (`--page`, `--ink`,
  `--accent`, `--radius`, `--map-*`, the type families) are generated into
  `ui/tokens.css` from `packages/theme` by `scripts/build-tokens-css.ts`
  before every dev server start, build and check — edit the theme, not the
  stylesheet.
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
glyph and on icon-library imports outside the icon modules named above.

The admin editor keeps its own light-themed `.btn` styles on purpose: it is
an internal tool with a different look, not a page of the site.

The mobile app has the same layer in `apps/mobile/src/ui`, built on the same
theme package: React Native primitives cannot be the site's React DOM ones,
so what the two clients share is everything a primitive is made of — the
palette, radii, spacing, type scale, map palette, icon sizes, the three
button variants (`primary`, `ghost`, `subtle`, plus the ghost's parchment
form on the map panel) and the icon vocabulary's role names. Both
`icons.ts` modules are type-checked against `SHARED_ICON_ROLES` in the
theme, so a role added on one side must be added on the other. Copy that
exists only in the app lives in the typed `mobile` namespace of
`packages/i18n`.

## Deployment

GitHub Actions (`.github/workflows/pages.yml`): `pnpm install`, `pnpm codes:check` (the committed `data/code_hashes.json` must match `private/codes.json`), `pnpm check`, `pnpm build`, then `apps/web/dist` is published to GitHub Pages. The `private/` directory never reaches the artifact.
