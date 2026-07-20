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

- `data/cottages.json` — publiczne lokalizacje Chatynek (`slug`, `lat`, `lng`) oraz lista zdjęć (`photos`),
- `cottages/*.md` — treści i frontmatter opowieści,
- `private/codes.json` — prywatne kody z tabliczek,
- `data/code_hashes.json` — publiczny indeks solonych skrótów kodów,
- `data/rewards.json` — Kronika: tytuł i wstęp oraz poziomy nagród (`id`, `name`, `threshold` albo `final`, `image`, `body`),
- `assets/stories/*.mp3` — nagrania opowieści,
- `assets/img/cottages/<slug>/` — zdjęcia chatynki,
- `assets/img/rewards/<id>/` — ilustracje kart nagród.

Statyczny hosting nie udostępnia listingu katalogów, więc `photos` w `data/cottages.json` jest jedynym źródłem wiedzy o tym, które zdjęcia istnieją i w jakiej kolejności je pokazać. Bez zdjęć strona pokazuje wspólną ilustrację.

Nagrody są w całości sterowane danymi: progi przyznawania, teksty i grafiki pochodzą z `data/rewards.json`. `src/lib/rewards.ts` zawiera tylko awaryjny zestaw używany, gdy pliku nie da się wczytać — identyfikatory poziomów są w obu miejscach takie same, żeby zdobyty postęp pasował niezależnie od źródła.

## Panel administracyjny (edytor zawartości)

Panel zapisuje zmiany bezpośrednio do repozytorium przez GitHub API. Token PAT jest przechowywany wyłącznie w `localStorage` przeglądarki. Publikowanie wielu zmienionych plików odbywa się w jednym commicie.

Pasek u góry przełącza dwie kategorie:

- **Chatynki** — nazwa, mieszkaniec, cnota, kod z tabliczki, pinezka na mapie (`lat`/`lng`), nagranie, zdjęcia i treść opowieści. Wszystko przed nagłówkiem `## Co zrobić, gdy trafisz pod chatynkę?` odblokowuje się dopiero po wpisaniu kodu; sekcja poniżej jest publiczna i widnieje w panelu chatynki na mapie.
- **Nagrody** — wstęp Kroniki oraz poziomy nagród: nazwa, próg (albo znacznik nagrody finałowej za komplet), ilustracja i opis w markdown. Poziomy można dodawać, usuwać i zmieniać ich kolejność, a podgląd obok pokazuje gotową kartę. Nagroda finałowa odblokowuje zaproszenie do Rankingu, więc jej identyfikator odczytywany jest z pliku — można ją swobodnie przemianować.

Obie kategorie mają własny stan „niezapisane"; przełączenie zakładki z niezapisaną pracą pyta, czy ją zapisać, porzucić, czy zostać.

## Konfiguracja rankingu

Klient Supabase i integracja Google znajdują się w `src/lib/sync.ts`. Ranking wykorzystuje tę samą lokalną historię odkryć co gra (`chatynkowo:state:v1`).
