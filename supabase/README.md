# Chatynkowo backend

The backend shared by the web site and the mobile app. Today it is a single
Supabase project; this directory describes it. The schema itself is not
versioned in the repository: changes are made in the project, and a local
`supabase db pull` dump (`supabase/migrations/`) is ignored by git.

## What the backend does today

| Element | Where | Used by |
|---|---|---|
| Google and Apple sign-in (browser OAuth on the site, native id tokens in the app) | Supabase Auth | `/ranking.html`, `index.html` (the account exchange), the app |
| `profiles` — nickname, avatar, `public_id`, `completed_at` | Postgres | leaderboard, profile |
| `finds` — discovered cottages per account | Postgres | Kronika sync |
| `leaderboard(p_total)` — the ranking | SQL function | `/ranking.html` |

What the backend does **not** do, and should not do without a reason: it does
not hold content. Stories, recordings, reward cards and the cottage list are
published statically from the repository (`data/`, `cottages/`, `assets/`)
and read through the content client in `@chatynkowo/core`. The database holds
what is per user and mutable.

Plaque codes are not checked in the database either: the site compares a
salted SHA-256 against the public `data/code_hashes.json`. That is enough as
long as finds carry no rewards of real value; once they do, move verification
into an Edge Function with rate limiting and a GPS position.

## Client code

`packages/api` is the only module that talks to Supabase. The web builds its
instance in `apps/web/src/lib/sync.ts`; the mobile app does the same with its
own session storage (see `apps/mobile/README.md`).

Schema types: `packages/api/src/database.types.ts`. Regenerate them after
every schema change:

```bash
supabase gen types typescript --linked > packages/api/src/database.types.ts
```

## Working with the schema

The tables, policies and the `leaderboard()` function were created through
the project's SQL editor and live there. To look at the live schema from a
checkout, link the project and pull it; the dump lands in
`supabase/migrations/`, which git ignores:

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref wqlodfnukdjrulcvzvtk
pnpm dlx supabase db pull            # dumps the real schema into a local, ignored migration
```

Schema changes go through the SQL editor of the project (or `supabase db
push` from a local dump); regenerate the types in `packages/api` afterwards.

Local environment (Docker): after a `db pull`, `pnpm dlx supabase start`
brings up Postgres, Auth and the dashboard on localhost with the pulled
schema. Put the local project's URL and key into `apps/web/.env`.

## Where to add things for the app

- **New per-user tables** (child profile, elf, inventory, visits with a
  verification level): a schema change in the project + "own rows" RLS +
  regenerated types.
- **Logic that cannot trust the client** (code verification, purchase
  entitlements, physical product codes): `supabase/functions/<name>/` as an
  Edge Function; the client calls it through `client.functions.invoke`.
- **Sign-in in the app**: Google through the native flow plus Sign in with
  Apple (an App Store requirement whenever Google is offered); the client
  code stays in `packages/api`. The setup is below.
- **Content** stays in the repository and the `/admin/` editor; the app
  fetches it from `https://www.chatynkowo.pl`.

## Sign-in providers

The site and the app share one Supabase Auth. The site signs in through the
browser OAuth flow (Google, Apple); the app hands the providers' native id
tokens to `signInWithIdToken`. Apple is offered on the site as well because
an account that began in the iOS app must be reachable from a browser.
Nothing here lives in the repository: it is the project's dashboard and the
two consoles.

### Google

1. Google Cloud, the project behind the site's OAuth consent screen: three
   OAuth client ids.
   - **Web** (already there for the site): its id and secret are the Supabase
     Google provider's credentials. The app needs the same id as
     `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: native Google sign-in asks for a
     token minted for this web client.
   - **iOS**: bundle id `pl.chatynkowo.app`. Its client id
     (`<id>.apps.googleusercontent.com`) is `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`;
     `app.config.ts` reverses it into the URL scheme the sign-in plugin needs.
   - **Android**: package `pl.chatynkowo.app` plus the SHA-1 of every signing
     key the app ships with (the debug key, the upload key, and Google Play's
     app signing key from the Play console).
2. Supabase, Authentication, Providers, Google: the web client's id and
   secret, and under "Authorized Client IDs" the iOS and the Android client
   ids, so the backend accepts the native tokens.
3. Supabase, Authentication, URL configuration: the site's addresses
   (`https://www.chatynkowo.pl/ranking.html`, `https://chatynkowo.pl/ranking.html`)
   among the redirect URLs for the browser flow.

### Apple

1. Apple Developer: the App ID `pl.chatynkowo.app` with the Sign in with
   Apple capability (`app.config.ts` requests it in every build through
   `ios.usesAppleSignIn`, unless `EXPO_PUBLIC_APPLE_SIGN_IN=0`); a Services ID for the site (its return URL is the project's
   callback, `https://wqlodfnukdjrulcvzvtk.supabase.co/auth/v1/callback`);
   a Sign in with Apple key (`.p8`) for that Services ID.
2. Supabase, Authentication, Providers, Apple: the Services ID as the client
   id with the secret generated from the key (team id, key id, the `.p8`),
   and under "Authorized Client IDs" the app's bundle id
   `pl.chatynkowo.app`, which is what the native identity tokens carry.

### What a seeker sees

Without the Google client id the app shows only the Apple button on iOS and
no account controls on Android; without the Apple capability in the build
(a free Personal Team cannot sign it) the Apple button stays away. The
Kronika works the same either way: an account only collects what the
devices found and hands it back to each of them.
