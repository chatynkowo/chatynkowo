# Chatynkowo

Wielostronicowa aplikacja React + TypeScript budowana przez Vite.

## Uruchomienie

```bash
pnpm install
pnpm dev
```

Kontrola typów i build produkcyjny:

```bash
pnpm check
pnpm build
```

Generowanie publicznych skrótów kodów z prywatnego źródła:

```bash
pnpm codes:build
```

## Wejścia aplikacji

- `/` — gra i Atlas Chatynkowa (`src/main.tsx`),
- `/ranking.html` — ranking graczy (`src/ranking-main.tsx`),
- `/admin/` — edytor treści i lokalizacji (`admin/editor.ts`).

Vite buduje wszystkie wejścia jednym procesem. Aktywna logika aplikacji jest zapisana w TypeScript; repozytorium nie przechowuje własnych plików JavaScript ani vendoringowanych bibliotek JS.

## Struktura danych

- `data/cottages.json` — publiczne lokalizacje Chatynek,
- `cottages/*.md` — treści i frontmatter opowieści,
- `private/codes.json` — prywatne kody z tabliczek,
- `data/code_hashes.json` — publiczny indeks solonych skrótów kodów,
- `assets/stories/*.mp3` — nagrania opowieści.

## Panel administracyjny

Panel zapisuje zmiany bezpośrednio do repozytorium przez GitHub API. Token PAT jest przechowywany wyłącznie w `localStorage` przeglądarki. Publikowanie wielu zmienionych plików odbywa się w jednym commicie.

## Konfiguracja rankingu

Klient Supabase i integracja Google znajdują się w `src/lib/sync.ts`. Ranking wykorzystuje tę samą lokalną historię odkryć co gra (`chatynkowo:state:v1`).
