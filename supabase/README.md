# Chatynkowo backend

The backend shared by the web site and the mobile app. Today it is a single
Supabase project; this directory keeps its schema as migrations so that every
change goes through the repository rather than the dashboard.

## What the backend does today

| Element | Where | Used by |
|---|---|---|
| Google sign-in (OAuth) | Supabase Auth | `/ranking.html` |
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
every migration:

```bash
supabase gen types typescript --linked > packages/api/src/database.types.ts
```

## Working with the schema

The migration `20260713000000_ranking.sql` is the script that was applied to
the production project through the SQL editor (it used to live in
`private/supabase/`). It is idempotent, so a fresh project can run it as is.
The first step with the CLI is to confirm that production still matches it:

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref wqlodfnukdjrulcvzvtk
pnpm dlx supabase db pull            # dumps the real schema into a new migration
```

If `db pull` shows differences, keep the dump as the baseline. From then on
every schema change is a new file in `migrations/`:

```bash
pnpm dlx supabase migration new <name>
pnpm dlx supabase db push
```

Local environment (Docker): `pnpm dlx supabase start` brings up Postgres, Auth
and the dashboard on localhost and applies the migrations from this directory.
Put the local project's URL and key into `apps/web/.env`.

## Where to add things for the app

- **New per-user tables** (child profile, elf, inventory, visits with a
  verification level): another migration + "own rows" RLS + types.
- **Logic that cannot trust the client** (code verification, purchase
  entitlements, physical product codes): `supabase/functions/<name>/` as an
  Edge Function; the client calls it through `client.functions.invoke`.
- **Sign-in in the app**: Google through the native flow plus Sign in with
  Apple (an App Store requirement whenever Google is offered). Both providers
  are enabled in the Auth dashboard; the client code stays in `packages/api`.
- **Content** stays in the repository and the `/admin/` editor; the app
  fetches it from `https://www.chatynkowo.pl`.
