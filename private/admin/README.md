# Chatynkowo — edytor wewnętrzny

Lokalny edytor danych chatynek. **Nigdy nie jest publikowany** — folder
`private/` jest wycinany z artefaktu GitHub Pages
(zob. [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml)).

## Wymagania

- Node.js 20+ (sprawdź: `node --version`)
- Skonfigurowany `git push` na zdalne `origin` (klucz SSH lub token)

## Uruchomienie

Z głównego katalogu repozytorium:

```bash
node private/admin/server.mjs
```

Następnie w przeglądarce:

```
http://127.0.0.1:8787/admin/
```

`Ctrl+C` w terminalu zatrzymuje serwer.

## Co edytor potrafi

- Wybierz chatynkę z listy w pasku u góry.
- **+ Dodaj nową** — utwórz nową chatynkę (podaj slug i tytuł, reszta
  pól ma sensowne domyślne wartości, do edycji).
- **Usuń bieżącą** — usuwa `cottages/<slug>.md`, wpis w `cottages.json`
  i plik mp3 (jeżeli istnieje). Cofnięcie: `git checkout` przed publikacją.
- Edytuj **nazwę**, **mieszkańca**, **cnotę**, **współrzędne (lat/lng)**
  i **markdown** treści.
- Kliknij na **bajkową mapę**, aby ustawić pinezkę (`mapX/mapY` jako procenty).
- Kliknij na **rzeczywistą mapę** lub przeciągnij pinezkę, aby ustawić `lat/lng`.
- **Wgraj/usuń plik mp3** w sekcji „Opowieść" — zapisuje się jako
  `assets/stories/<slug>.mp3`.
- **Zdjęcia** — wgraj wiele plików naraz w sekcji „Zdjęcia". Trafiają do
  `assets/img/cottages/<slug>/`. Akceptowane: `.webp .jpg .png .gif .avif`
  (do 15 MB każdy). Kliknij `×` na miniaturze, aby usunąć.
- Kliknij **Zapisz** (`Ctrl+S`), aby zapisać do plików.
- Kliknij **Publikuj**, aby zrobić commit i `git push` — GitHub Pages
  przebuduje stronę automatycznie po kilkudziesięciu sekundach.

## Co edytor zapisuje gdzie

| Pole formularza | Plik |
|-----------------|------|
| nazwa, mieszkaniec, cnota, lat, lng, treść | `cottages/<slug>.md` |
| nazwa (title), lat, lng, mapX, mapY | `data/cottages.json` |
| audio | `assets/stories/<slug>.mp3` |
| zdjęcia | `assets/img/cottages/<slug>/*.{webp,jpg,png,gif,avif}` |

> **Uwaga:** zdjęcia są zapisywane na dysku i commitowane do repozytorium,
> ale strona publiczna nie ma jeszcze galerii — to osobny krok (np. dodanie
> sekcji `## Galeria` z `<img>`-ami w treści chatynki, albo rozszerzenie
> [`main.js`](../../main.js), aby czytała pliki z folderu).

Zmiany w jednym polu mogą trafić do dwóch plików — np. zmiana **lat**
trafia i do `.md`, i do `cottages.json`.

## Zmiana portu / hosta

```bash
ADMIN_PORT=9000 ADMIN_HOST=0.0.0.0 node private/admin/server.mjs
```

Domyślnie nasłuchuje tylko na `127.0.0.1`, więc nikt z sieci lokalnej
nie ma dostępu.

## Co jeśli „Publikuj" zwróci błąd?

Najczęstsze przyczyny:

- repo jest na innym branchu niż `main` — przełącz się ręcznie i ponów
- nie ma uprawnień do `git push` — sprawdź klucz SSH (`ssh -T git@github.com`)
- konflikt z `origin/main` — zrób `git pull --rebase` w terminalu i ponów

W razie czego zmiany są już zapisane lokalnie — możesz wepchnąć je
ręcznie z terminala.
