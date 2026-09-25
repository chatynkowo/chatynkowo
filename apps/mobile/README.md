# Mobile app (React Native)

This directory is intentionally empty: the app starts from scratch, and the
monorepo hands it ready-made building blocks. Below is what to take and how to
wire it up.

## Bootstrap

```bash
pnpm dlx create-expo-app@latest apps/mobile --template blank-typescript
cd apps/mobile
pnpm add @chatynkowo/core@workspace:* @chatynkowo/api@workspace:* @chatynkowo/i18n@workspace:*
```

If Metro cannot resolve workspace packages, uncomment `node-linker=hoisted`
in the repository root `.npmrc` and run `pnpm install` again. Metro in a
monorepo also needs a `metro.config.js` whose `watchFolders` points at the
repository root (the template is in the Expo docs: "Work with monorepos").

Packages are published as TypeScript sources (`main: src/index.ts`), so Metro
compiles them together with the app, with no build step.

## What the packages provide

| Package | Contents | Notes for React Native |
|---|---|---|
| `@chatynkowo/core` | types, languages, content client, reward and progress rules, geography, plaque codes | `createContentClient({ baseUrl: 'https://www.chatynkowo.pl', sha256Hex })` — Hermes has no WebCrypto, supply a hash from `expo-crypto` |
| `@chatynkowo/api` | Supabase client and leaderboard functions | keep the session in `AsyncStorage` or `expo-secure-store`, turn `detectSessionInUrl` off |
| `@chatynkowo/i18n` | `pl` and `en` dictionaries | wire them into your own i18next instance with the language from `expo-localization` |

Wiring example:

```ts
import * as Crypto from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContentClient } from '@chatynkowo/core'
import { createChatynkowoClient } from '@chatynkowo/api'

export const content = createContentClient({
  baseUrl: 'https://www.chatynkowo.pl',
  sha256Hex: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
})

export const supabase = createChatynkowoClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  options: {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  },
})
```

## What the app has to solve itself

- **Offline progress.** The rules are in `core` (`discoverCottage`,
  `backfillBadges`, `mergeFinds`); you pick the storage. Save locally and
  push to the account with `syncFinds` when the network is back; the forest
  often has no signal.
- **Codes without a network.** `loadCodeLookup()` once, then `lookupCode()`
  locally.
- **Sign-in.** `signInWithGoogle` from `api` is the browser flow; in the app
  use native Google sign-in and Sign in with Apple, and hand the token to
  `client.auth.signInWithIdToken`.
- **Map, background audio, notifications, camera** — native libraries,
  outside the scope of the shared packages.
