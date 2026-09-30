# Chatynkowo mobile app

The expedition loop of the site as a native app, offline-first: the Atlas
(map of cottages), plaque-code entry (four digits or a QR scan), the story
with its recording, the Kronika (rewards), the leaderboard and a profile.
Expo SDK 57, TypeScript, expo-router, a development client (native modules
are used, so Expo Go cannot run it).

The app owns only its interface, navigation and native adapters. Everything
that is domain logic lives in the shared packages: `@chatynkowo/core`
(content, codes, progress, geography, offline rules), `@chatynkowo/api`
(the Supabase backend) and `@chatynkowo/i18n` (the dictionaries, including
the app-only `mobile` namespace).

## Running

Prerequisites: Node 22, pnpm 11, and for a device build Android Studio
(SDK + an emulator or a USB device) or Xcode on macOS.

```bash
pnpm install                        # from the repository root, once
cd apps/mobile
npx expo run:android                # builds and installs the dev client, starts Metro
npx expo run:ios                    # macOS only
npx expo start --dev-client         # later starts, with the client already installed
```

The native projects (`android/`, `ios/`) are generated from `app.json` by
continuous native generation and are not committed; `expo run:*` creates
them on demand. After changing `app.json` or adding a native module, run
`npx expo prebuild --clean` or simply `expo run:*` again.

Configuration comes from `EXPO_PUBLIC_*` variables in `apps/mobile/.env`
(template: `.env.example`); without the file the app uses the production
Supabase project and `https://www.chatynkowo.pl` as the content origin.

Because the content origin is the published site, a change under
`packages/content/public` (a new cottage, a translation) reaches the app
only once the site is deployed. To review it earlier, serve the package
from the site's dev server and point the app at it through the emulator's
port forwarding:

```bash
pnpm --filter @chatynkowo/web dev                   # serves packages/content/public at http://127.0.0.1:5173
adb reverse tcp:5173 tcp:5173                       # the emulator's localhost:5173 -> the host
echo 'EXPO_PUBLIC_CONTENT_BASE_URL=http://localhost:5173' > apps/mobile/.env
npx expo start --dev-client --clear                 # the variable is inlined at bundle time
adb shell pm clear pl.chatynkowo.app                # the content cache keeps files for up to a day
```

Remove the `.env` line afterwards; with it, the app needs that server.

### A standalone APK for a phone

The release variant embeds the JS bundle, so the installed app needs
neither Metro nor the computer, like one from a store. Build it with no
`.env` in place (the `EXPO_PUBLIC_*` values are inlined at build time):

```bash
cd apps/mobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a   # phones; drop the flag for a universal APK (all four ABIs, ~2.5x larger)
# -> app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk     # over USB or Wi-Fi debugging, or copy the file to the phone and open it
```

The release variant is signed with the debug keystore of the generated
project, which is fine for your own devices but not for Google Play; a
store build needs its own keystore or EAS Build.

Checks, run from the repository root:

```bash
pnpm check                                          # type-checks every package, incl. the app, plus the conventions script
pnpm --filter @chatynkowo/mobile export:android     # bundles the JS for Android through Metro (no SDK needed)
```

### Android SDK without Android Studio (Linux)

Everything the build needs can be installed from the command line into the
home directory, no root required:

```bash
# JDK 17 (Temurin) into ~/.jdks, then the SDK command line tools into ~/Android/Sdk
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "emulator" \
  "system-images;android-36;google_apis;x86_64" "ndk;27.1.12297006" "cmake;3.22.1"
avdmanager create avd --name chatynkowo --package "system-images;android-36;google_apis;x86_64" --device pixel_8
```

Set `JAVA_HOME`, `ANDROID_HOME` and put `platform-tools`, `emulator` and
`cmdline-tools/latest/bin` on the path. The emulator's x86_64 images need
KVM: `/dev/kvm` must exist (virtualisation enabled in the firmware, the
`kvm_amd` / `kvm_intel` module loaded) and the user must be in the `kvm`
group. `emulator -accel-check` tells you which of these is missing.

Metro is configured in `metro.config.js` to watch the repository root and
to resolve from both `node_modules` directories, which is enough for pnpm's
isolated layout; `node-linker=hoisted` in the root `.npmrc` stays commented
out unless a future native module needs it.

Watching the whole monorepo needs more inotify watches than Linux grants
by default; when edits stop reaching the app (Metro logs no "Bundled"
line), raise the limit or install Watchman:

```bash
sudo sysctl fs.inotify.max_user_watches=524288   # or: sudo apt install watchman
```

## Structure

```
app/                     expo-router routes
  _layout.tsx            fonts and the bootstrap behind the splash, the providers, the root native Stack:
                         welcome and (tabs) behind Stack.Protected guards, the sheets and modals on top
  welcome.tsx            the onboarding pager (the lore; the four questions and the creed; the guide as a trail;
                         the photo, the notes and the two ways to begin), first launch only
  (tabs)/_layout.tsx     the tab bar (src/ui/TabBar.tsx): Atlas / Kronika / Ranking / Profile around a raised gold
                         centre button that opens the code sheet (long press: the scanner)
  (tabs)/index.tsx       the Atlas: the full-bleed map with floating chrome, the quest card, the seeker's position
                         and the parchment cottage sheet (a gesture sheet with three snaps)
  (tabs)/kronika/        its own native stack: the collection grid with the progress card
  (tabs)/ranking/        its own native stack: the leaderboard list, the rules and share header items
  (tabs)/profile/        its own native stack: grouped settings (account, language, lore, legal, social),
                         about.tsx (the lore sections) and guide.tsx (the onboarding pager replayed)
  code.tsx               the code entry as a form sheet (auto-submits at the fourth digit)
  scan.tsx               the QR scanner, full screen under a transparent bar with torch and close items
  cottages.tsx           every cottage, found first, with a search box and an undiscovered-only filter: one page
                         sheet from the Atlas's search control (keyboard up) and the Kronika's progress card
  story/[slug].tsx       the story as a page sheet: the unlock ceremony the first time, a plain revisit later
  celebrate.tsx          the reward reveal, a transparent modal the Atlas presents after a story
  reward/[id].tsx        one reward card, a form sheet that opens at medium height and expands to full
  rules.tsx              the ranking rules, form sheet
  +native-intent.tsx     where a URL handed to the app goes (plaque links with a code, story and reward links)
  +not-found.tsx         redirects to the Atlas
src/
  config.ts              EXPO_PUBLIC_* with production defaults, storage keys
  i18n/                  the i18next instance: "translation" + "mobile" namespaces, device locale, remembered choice
  ui/                    the interface layer: tokens, fonts, icons (plus the tab glyphs and the native header symbols), motion
                         tokens, Text, Button/LinkButton/IconButton on PressableScale, Screen, ContentImage (expo-image),
                         Skeleton, ProgressRing, ProgressBar, CrossfadeText, PageDots, GlowPulse, EmptyState, Toast,
                         SettingsList, SheetHandle, TabStack, headerItems, TextField, MarkdownView
  lib/                   adapters: bootstrap (what the splash reads), cached content client, progress + sync-queue
                         storage, Supabase and native sign-in, audio (expo-audio), recordings (file system), maps
                         hand-off, position, reachability store, haptics, accessibility announcements
  providers/             BootProvider, NetworkProvider, SessionProvider, ContentProvider, ProgressProvider, ToastProvider
  features/              screen-level components per area: atlas/, code/, cottages/ (the directory both tabs open), story/, kronika/, ranking/, profile/, welcome/
plugins/                 config plugins: with-scene-delegate.js (UIScene life cycle for the iOS 27 SDK)
locales/                 native permission strings per language (iOS Info.plist)
assets/                  app icon, adaptive icon layers, the splash emblem and the logo, generated from the brand logo in
                         packages/content/private/img
```

Navigation model: the tab bar holds destinations only (the Atlas, the
collection, the leaderboard, the profile); entering a code is an action and
lives in a sheet reachable from the tab bar's centre button, the cottage sheet, the
onboarding, the empty states and plaque links, so every `/code` href still
works. A discovery runs in place (the sheet or the scanner shows the
outcome), the story replaces that screen, and the Atlas presents the reward
reveal once the story has closed. Motion goes through the tokens in
`src/ui/motion` (reanimated 4, system reduce-motion respected) and haptics
through `src/lib/haptics.ts`.

## How the data flows

- **Content** (`src/lib/content.ts`, `ContentProvider`): the core content
  client reads the published files (the `packages/content/public` tree, as
  the site serves it) from the site origin; every file is kept
  in AsyncStorage as a `CacheEntry` and served stale-while-revalidate: a
  fresh copy is used as is, a stale one is shown at once and refreshed in
  the background, and with no network the stale copy is final. A cold start
  in airplane mode therefore shows the last known map, stories, rewards and
  code lookup. Only the very first launch needs a connection.
- **Codes** (`src/features/code/useCodeEntry.ts`): the four digits are
  hashed with expo-crypto and matched against the cached lookup on the
  device (`lookupCode` from core); manual entry and the scanner feed the same
  hook. The scanner extracts the code from the QR payload with
  `codeFromScan` (bare digits, or a `kod`/`code` parameter in a link).
- **Progress** (`ProgressProvider`, `src/lib/progress-store.ts`): the local
  Kronika is the source of truth (`StoredState`, the same shape as the site
  and the backend). A discovery runs the core rules, is saved, and lands in
  the sync queue (`SyncQueue`, core `offline.ts`); the queue is pushed with
  `syncFinds` whenever the device is online and someone is signed in, and
  retried on every reconnect. Signing in exchanges finds with the account
  (earliest date wins, nothing is ever removed).
- **Account** (`SessionProvider`, `src/lib/sync.ts`): the Supabase session
  lives in AsyncStorage with URL detection off; token refresh runs only in
  the foreground. Sign-in is native: Google (`@react-native-google-signin`)
  and Apple (`expo-apple-authentication`), both handed to
  `signInWithIdToken`. It is hidden behind `EXPO_PUBLIC_AUTH_ENABLED` until
  the providers are configured in the backend; the app is fully usable
  signed out.

## Native pieces

| Area | Library | Notes |
|---|---|---|
| Map | `@maplibre/maplibre-react-native` | the site's fairy-tale map: OpenStreetMap tiles washed into parchment that turn real as the seeker zooms in, teardrop pins gathered into clusters (`supercluster`), the search area around the chosen cottage, the level indicator, reset and search controls, the parchment cottage panel, a beacon at the edge of the map towards the nearest cottage with its distance when none is in view (the map keeps north up: no rotation); the same per-country opening frame as the site (`homeCountry` / `homeBounds` in core `geo.ts`); "Navigate" opens the system maps app |
| Position | `expo-location` | foreground permission asked from the locate control; once granted the Atlas watches the position while it is focused (balanced accuracy, 20 m) and shows it as a dot under the pins; the launch's first fix frames the seeker with the nearest cottage (unless they moved the map or framed a cottage already), the control centres the map; a one-time grant that lapsed while the app was away is asked for again by the Atlas, once per launch, once the seeker has located themselves before |
| Splash | `expo-splash-screen` | the brand logo on the page colour until the fonts and the bootstrap (language, progress, cached content, flags; capped at 1500 ms) are in, then a 300 ms fade into a fully formed first frame |
| Story audio | `expo-audio` | background playback (`UIBackgroundModes: audio` via its plugin) and lock-screen / notification controls (`setActiveForLockScreen`); a language without a recording falls back to the Polish original when the file fails to load |
| Recordings offline | `expo-file-system` | "Save on this device" downloads the mp3 into the document directory, one folder per language; a saved file plays from disk |
| QR | `expo-camera` | `CameraView` scanning `qr` only, torch from the header; the code is resolved on the scanner itself through the same `useCodeEntry` as manual entry |
| Tabs and stacks | `react-native-screens` through expo-router | a custom tab bar (`Tabs` from expo-router/js-tabs with the `tabBar` prop; it reports its height through `useTabBarHeight` so screens keep clear of it), native stack headers (transparent with the system glass on iOS), `formSheet` routes for the code, reward and rules, `modal` page sheets for the story and the cottage list |
| Cottage sheet | `@gorhom/bottom-sheet` | the in-screen parchment sheet over the map with three snaps; the map stays pannable and the camera keeps room for the sheet |
| Motion | `react-native-reanimated` 4 + `react-native-gesture-handler` | springs, entrances, the progress ring, the scrub bar, the toast gesture; every animation passes `ReduceMotion.System` |
| Haptics | `expo-haptics` | one module (`src/lib/haptics.ts`): selection on controls, light on primary actions, medium on a pin and the seal, success and error on the code result |
| Images | `expo-image` | `ContentImage`: memory and disk cache, cross-dissolve, retries with a backoff and on reconnect, a quiet fallback after the last failure, prefetch of the reward art and the found cottages' photos |
| Legal pages | `expo-web-browser` | the terms and privacy pages open in an in-app browser sheet |
| Fonts | `expo-font` + `@expo-google-fonts/*` | Cormorant Garamond and Cinzel Decorative, imported per weight; the repository's woff2 files cannot be used natively |
| Locale | `expo-localization` | the device language picks the dictionary and, through `detectCountry`, the map's home country (never geolocation) |
| Country names | `@formatjs/intl-displaynames` | Hermes has no `Intl.DisplayNames`; the polyfill with Polish and English data names a cottage's country in the map panel, as the site does |
| Scene life cycle | `plugins/with-scene-delegate.js` | config plugin for the iOS 27 SDK, which asserts at launch unless the app adopts UIScene: the generated `AppDelegate` conforms to `ExpoReactNativeFactoryProvider` and stops starting React Native itself, a `SceneDelegate` subclasses Expo's `ExpoAppSceneDelegate` (it creates the window and starts React Native from the scene), and `Info.plist` gets the `UIApplicationSceneManifest`; idempotent, skipped from SDK 58 on (the template adopts scenes itself), refuses an expo older than 57.0.25 |

Google sign-in on iOS additionally needs the library's config plugin with
the `iosUrlScheme` from the Google Cloud console; add it to `app.json`
`plugins` when the provider is configured (the plugin refuses to run
without the scheme, which is why it is not listed yet). Apple sign-in needs
the capability on the App ID; `ios.usesAppleSignIn` is already set.

TODO universal links: the plaque QR carries `https://www.chatynkowo.pl/?kod=NNNN`. The Android half is in place (`android.intentFilters` for `https://www.chatynkowo.pl/`, `/index.html` and `https://chatynkowo.pl/` with `autoVerify`; it stays a plain browser choice until the site serves `/.well-known/assetlinks.json` with `delegate_permission/common.handle_all_urls` for `pl.chatynkowo.app` and the release signing SHA-256). The iOS half is not: add `ios.associatedDomains: ["applinks:www.chatynkowo.pl", "applinks:chatynkowo.pl"]` to `app.json` only once the site serves `/.well-known/apple-app-site-association` (applinks for `<TEAMID>.pl.chatynkowo.app` with components for `/` and `/index.html` carrying a `kod` or `code` query, so `ranking.html` share links keep opening the website), because the Associated Domains capability changes device code signing. `app/+native-intent.tsx` already maps both URL forms to the code sheet.

## Conventions

- Icons come only from `src/ui/icons.ts`, which mirrors the web vocabulary
  name for name (`CloseIcon`, `ChronicleIcon`, ...) and the `iconSize`
  scale; the role names are the theme's `SHARED_ICON_ROLES` and
  `MOBILE_ICON_ROLES`, checked at compile time. `phosphor-react-native` is
  imported nowhere else, and no emoji or typographic glyph is used as an
  icon. `scripts/check-conventions.mjs` enforces both as part of `pnpm check`.
- Screens compose the primitives in `src/ui` and never restyle them; the
  tokens come from `@chatynkowo/theme`, the same package the site's
  stylesheet is generated from, so a colour changes in one place for both
  clients.
- Every user-facing string goes through i18next: the shared set
  (`packages/i18n/src/shared/`) as the `translation` namespace, the app-only
  set (`packages/i18n/src/mobile/`) as `mobile`, typed so both languages
  stay complete; the site's own strings live in `packages/i18n/src/web/`.
- Domain logic that a screen needs goes to `@chatynkowo/core` first, then
  is consumed here.

## Extending

- A new tab is one `Tabs.Screen` in `app/(tabs)/_layout.tsx` (glyph in
  `TAB_ICONS`, `src/ui/icons.ts`) plus a file or a folder with a `TabStack`
  layout; a new top-level surface (a companion's cottage, say) is one
  `Stack.Screen` in `app/_layout.tsx`, as a sheet or a modal.
- Per-user state that must reach the account follows the finds pattern:
  rules in core, a store in `src/lib`, a queue entry in `SyncQueue`, a
  push in `ProgressProvider`.
- The content cache takes any loader: `cached(name, maxAge, loader)` in
  `src/lib/content.ts`.

Not in this iteration, deliberately: analytics, notifications and
geofencing.
