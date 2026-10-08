# Chatynkowo mobile app

The expedition loop of the site as a native app, offline-first: the Atlas
(map of cottages), plaque-code entry (four digits or a QR scan), the story
with its recording, the Kronika (rewards), the leaderboard and a profile,
plus a sheet to support Chatynkowo with a coffee for the elf (a store
purchase) or a rewarded ad (see "Supporting Chatynkowo" at the end).
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

The native projects (`android/`, `ios/`) are generated from `app.json` (and
`app.config.ts`, which adds what depends on the environment) by continuous
native generation and are not committed; `expo run:*` creates them on
demand. After changing either file or adding a native module, run
`npx expo prebuild --clean` or simply `expo run:*` again.

Tablets are first-class: the iPhone keeps portrait, the iPad takes every
orientation (`UISupportedInterfaceOrientations~ipad`), and since iPadOS 26
runs apps in windows of any shape, reading content keeps to the readable
width (`sizes.readable`, the `readable` column style in `src/ui`) while the
Atlas stays full-bleed.

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
adb shell pm clear com.blockchainwares.app.mysterious.cottages   # the content cache keeps files for up to a day
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

### Store builds (EAS Build)

The release variant above is signed with the generated project's debug
keystore, which Google Play does not accept: a store build is a signed
app bundle (AAB) built with EAS Build, on this machine (`--local`, no
queue, nothing uploaded) or in Expo's cloud. `eas.json` holds the
profiles and `.easignore` at the repository root keeps the site, the
backend notes, the authored content and the private plaque codes out of
a cloud upload (EAS uploads the whole monorepo otherwise; the app reads
content from the published site, so it needs none of it). The CLI runs
through `pnpm dlx` at a pinned version, so nothing is installed
globally.

The upload keystore is the one registered with Google Play for
`com.blockchainwares.app.mysterious.cottages` (Setup, App signing,
"Upload key certificate"; its SHA-1 begins with `DD:F2:E9`). The
production profile takes it from a local `credentials.json`
(`credentialsSource: local`; the file is ignored by git and points at
the keystore kept outside the repository, with its passwords), so a
store build never depends on the keystore EAS generated for itself:

```json
{ "android": { "keystore": { "keystorePath": "/home/<you>/keys/chatynkowo/upload.jks",
  "keystorePassword": "...", "keyAlias": "...", "keyPassword": "..." } } }
```

A bundle signed with any other key is refused by the Play Console. The
keystore and its passwords are backed up outside the repository (the
backup downloaded from expo.dev, under the project's credentials, is the
same file); losing them means an upload key reset request in the Play
Console.

```bash
cd apps/mobile
pnpm eas login                  # once per machine, the Expo account that owns the project
pnpm eas init                   # once per project: writes extra.eas.projectId into app.json (commit it)
pnpm build:android:local        # production: AAB built here, signed with credentials.json (the usual way)
pnpm build:android              # the same in Expo's cloud (queued on the free plan)
pnpm build:android:preview      # an installable APK of the same code, for a phone without the store
pnpm submit:android             # the latest AAB to the Play internal testing track as a draft release
                                # (needs a Google service account JSON, see below; uploading by hand works too)
```

The `EXPO_PUBLIC_*` variables are inlined into the JS bundle at build time
and `.env` never reaches EAS (`.easignore`), so a store build takes them
from the project's EAS environment variables, one set per profile
environment (`production`, `preview`, `development`): the Google web
client id for sign-in and the AdMob ids for the rewarded ad.

```bash
pnpm eas env:set --scope project --environment production --visibility plaintext --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <id>
pnpm eas env:set --scope project --environment production --visibility plaintext --name EXPO_PUBLIC_ADMOB_ANDROID_APP_ID --value <id>
pnpm eas env:set --scope project --environment production --visibility plaintext --name EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID --value <id>
pnpm eas env:list --environment production
```

A build without the AdMob variables still works: the support sheet says
this version shows no ads. `pnpm eas credentials --platform android`
shows the upload key's SHA-1, which the Google sign-in client needs next
to the SHA-1 of Play's app signing key (supabase/README.md, "Sign-in
providers"). `eas submit` needs a Google Play service account with
access to the app; its JSON key is referenced from `eas.json` as
`serviceAccountKeyPath` or kept in the EAS environment as
`GOOGLE_SERVICE_ACCOUNT_KEY`, never committed.

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
  (tabs)/profile/        its own native stack: grouped settings (account, language, lore, legal, social) with the
                         support invitation, account.tsx (the signed-in account: identity, leaderboard entry, finds,
                         sign-out, deletion), about.tsx (the lore sections) and guide.tsx (the onboarding pager replayed)
  code.tsx               the code entry as a sheet (auto-submits at the fourth digit)
  scan.tsx               the QR scanner, full screen under a transparent bar with torch and close items
  cottages.tsx           every cottage, found first, with a search box and an undiscovered-only filter: one page
                         sheet from the Atlas's search control (keyboard up) and the Kronika's progress card
  story/[slug].tsx       the story as a page sheet: the unlock ceremony the first time, a plain revisit later
  celebrate.tsx          the reward reveal, a transparent modal the Atlas presents after a story
  reward/[id].tsx        one reward card, a sheet that opens at three fifths and can be pulled to the top
  rules.tsx              the ranking rules, a sheet sized to its content
  support.tsx            supporting Chatynkowo, a sheet opened by the support invitations: a coffee for the elf (a purchase
                         through the store) or a rewarded ad watched instead
  nickname.tsx           the nickname editor, a sheet from the account screen and the Ranking's "Change nickname" item
  +native-intent.tsx     where a URL handed to the app goes (plaque links with a code, story and reward links)
  +not-found.tsx         redirects to the Atlas
src/
  config.ts              EXPO_PUBLIC_* with production defaults (including the account preview flag), storage keys
  i18n/                  the i18next instance: "translation" + "mobile" namespaces, device locale, remembered choice
  ui/                    the interface layer: tokens, fonts, icons (plus the tab glyphs and the native header symbols), motion
                         tokens, Text, Button/LinkButton/IconButton on PressableScale, Screen, ContentImage (expo-image),
                         Skeleton, ProgressRing, CrossfadeText, PageDots, GlowPulse, EmptyState, Toast,
                         SettingsList, Sheet (the base of every sheet route), TabStack, headerItems, TextField, MarkdownView
  lib/                   adapters: bootstrap (what the splash reads), cached content client, progress + sync-queue
                         storage, Supabase and native sign-in, the account preview stand-in (development builds only),
                         audio (expo-audio), recordings (file system), maps hand-off, position, reachability store,
                         store billing (the coffee), the support ledger, haptics, accessibility announcements
  providers/             BootProvider, NetworkProvider, SessionProvider, ContentProvider, ProgressProvider, ToastProvider,
                         SupportProvider (the store connection, the coffee menu and the receipt of support),
                         useCloseModal (the one way a modal route closes)
  features/              screen-level components per area: atlas/, code/, cottages/ (the directory both tabs open), story/, kronika/, ranking/, profile/, welcome/
  features/profile/      the settings list, the account screen (the identity header, the leaderboard entry with the
                         photo switch, the finds, sign-out and the delete-account confirm) and the nickname editor
  features/support/      supporting Chatynkowo: the sheet, the coffee menu with the store product ids (tips.ts), the
                         rewarded ad with the consent flow (useRewardedSupportAd.ts), the ledger hook, and the
                         invitation card (SupportCard.tsx) the other screens mount
app.config.ts            the configuration that depends on the environment: the AdMob app ids of the support sheet's rewarded
                         ad (Google's sample ids until EXPO_PUBLIC_ADMOB_*_APP_ID are set), Sign in with Apple (the capability and its
                         plugin, unless EXPO_PUBLIC_APPLE_SIGN_IN is 0), the Google sign-in plugin with the iOS URL scheme
                         derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, the app's Apple team (signing, and the Sign in
                         with Apple key the backend script reads from here)
plugins/                 config plugins: with-scene-delegate.js (UIScene life cycle for the iOS 27 SDK),
                         with-locale-filters.js (only the app's languages in the Android resources),
                         with-gradle-heap.js (the Gradle daemon's heap, which R8 needs for a release build)
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
reveal once the story has closed. Supporting Chatynkowo is an action too,
a sheet (`/support`) opened by the invitation card wherever it is mounted
(see "Supporting Chatynkowo"); so is changing the nickname, a sheet
(`/nickname`) opened from the account screen and from the Ranking. Motion goes through the tokens in
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
  and Apple (`expo-apple-authentication`, with a nonce the backend checks
  against the token), both handed to `signInWithIdToken`. The build offers what it can: the Google button once
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set (on iOS once
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is too), the Apple button on iOS unless
  `EXPO_PUBLIC_APPLE_SIGN_IN=0` left the capability out of the build; with
  neither, the account controls stay hidden and the app runs signed out,
  like the site. A closed
  dialog is not a failure; a failure is a toast and a console line. Signing
  out revokes the session when the backend can be reached and forgets it on
  the device either way; the sync queue ends with the session, the Kronika
  stays.
- **Account screen** (`app/(tabs)/profile/account.tsx`, `app/nickname.tsx`,
  `src/features/profile`): the signed-in seeker's own page, pushed from the
  Profile tab. An identity header shows the provider's picture, the
  nickname and the e-mail of the Google or Apple account signed in with;
  the leaderboard entry section shows the nickname with a row that opens
  the nickname editor as a sheet (the same sheet the Ranking's "Change
  nickname" item opens) and a switch for showing the account photo next to
  it; a finds section says how many discoveries the account holds; then
  sign-out, and at the end "Delete account" behind a confirm. Deleting
  calls `deleteAccount` in `src/lib/sync.ts` (the api's `deleteAccount`:
  the backend's `delete-account` Edge Function removes the finds, the
  profile and the auth user, then the local session is forgotten; see
  `supabase/README.md`, "Deleting an account"); the Kronika on the device
  stays, like after a sign-out. A refusal is a toast and the session is
  kept for another try.
- **Account preview** (`src/lib/account-preview.ts`): with
  `EXPO_PUBLIC_ACCOUNT_PREVIEW=1` in `apps/mobile/.env` a development
  build behaves as if a Google account were signed in, so the account
  screen, the nickname sheet and the signed-in Ranking can be looked at on
  an emulator that has no Google sign-in configured. `sync.ts` answers
  every account call from a stand-in account (sign-in, profile, nickname
  changes, sign-out, deletion) and nothing reaches the backend; the finds
  stay on the device. The flag is read under `__DEV__` only, so a release
  build cannot carry it. The variable is inlined by Metro: after setting it
  restart the dev server (`npx expo start --dev-client --clear`) and reload
  the app; no native rebuild is needed.

- **Support** (`SupportProvider`, `src/lib/billing.ts`,
  `src/features/support`, `src/lib/support-store.ts`): the two voluntary
  ways to support Chatynkowo, a coffee for the elf (a consumable product
  bought through the store) and a rewarded ad, neither of which unlocks
  anything (see "Supporting Chatynkowo" below). The store connection
  opens with the app and stays, so a purchase settled outside the sheet
  is still finished and thanked for. The ledger of what was given lives in
  AsyncStorage under `STORAGE_KEYS.support`, on the device only; the
  invitation card reads it to turn into a thank-you after the first
  support.

## Native pieces

| Area | Library | Notes |
|---|---|---|
| Map | `@maplibre/maplibre-react-native` | the site's fairy-tale map: OpenStreetMap tiles washed into parchment that turn real as the seeker zooms in, teardrop pins gathered into clusters (`supercluster`), the search area around the chosen cottage, the level indicator, reset and search controls, the parchment cottage panel, a beacon at the edge of the map towards the nearest cottage with its distance when none is in view (the map keeps north up: no rotation); the same per-country opening frame as the site (`homeCountry` / `homeBounds` in core `geo.ts`); "Navigate" opens the system maps app |
| Position | `expo-location` | foreground permission asked from the locate control; once granted the Atlas watches the position while it is focused (balanced accuracy, 20 m) and shows it as a dot under the pins; the launch's first fix frames the seeker with the nearest cottage (unless they moved the map or framed a cottage already), the control centres the map; a one-time grant that lapsed while the app was away is asked for again by the Atlas, once per launch, once the seeker has located themselves before |
| Splash | `expo-splash-screen` | the brand logo on the page colour until the fonts and the bootstrap (language, progress, cached content, flags; capped at 1500 ms) are in, then a 300 ms fade into a fully formed first frame |
| Story audio | `expo-audio` | background playback (`UIBackgroundModes: audio` via its plugin) and lock-screen / notification controls (`setActiveForLockScreen`); a language without a recording falls back to the Polish original when the file fails to load |
| Recordings offline | `expo-file-system` | "Save on this device" downloads the mp3 into the document directory, one folder per language; a saved file plays from disk |
| QR | `expo-camera` | `CameraView` scanning `qr` only, torch from the header; the code is resolved on the scanner itself through the same `useCodeEntry` as manual entry |
| Tabs and stacks | `react-native-screens` through expo-router | a custom tab bar (`Tabs` from expo-router/js-tabs with the `tabBar` prop; it reports its height through `useTabBarHeight` so screens keep clear of it), native stack headers (transparent with the system glass on iOS), `transparentModal` routes carrying the shared sheet (src/ui/Sheet.tsx) for the code, reward and rules, `modal` page sheets for the story and the cottage list |
| Sheets | `@gorhom/bottom-sheet` | one base for every sheet: the in-screen parchment panel over the map (three snaps, the map stays pannable, the camera keeps room for it) and the sheet routes (the code gate, a reward, the rules), which open at their own height or part-way and can be pulled to the top; a scroll inside moves the content first |
| Motion | `react-native-reanimated` 4 + `react-native-gesture-handler` | springs, entrances, the progress ring, the scrub bar, the toast gesture; every animation passes `ReduceMotion.System` |
| Haptics | `expo-haptics` | one module (`src/lib/haptics.ts`) and only three moments: medium on the seal of a fresh find, success on an accepted code and a revealed reward, error on a refused code; no control, tab, pager or toast vibrates; iOS uses the UIKit generators, Android the system `HapticFeedbackConstants` through `performAndroidHapticsAsync` (the OEM's short click, under the system touch-feedback setting and intensity), with the Vibrator notification patterns kept only for success and error below API 30 |
| Images | `expo-image` | `ContentImage`: memory and disk cache, cross-dissolve, retries with a backoff and on reconnect, a quiet fallback after the last failure, prefetch of the reward art and the found cottages' photos |
| Legal pages | `expo-web-browser` | the terms and privacy pages open in an in-app browser sheet |
| Store billing | `expo-iap` | the coffee for the elf as consumable products through Google Play Billing and StoreKit 2 (`src/lib/billing.ts`, driven by `SupportProvider`): listeners registered before the connection opens and kept for the life of the app, every paid purchase finished at once (consumed on Android), the leftovers settled at launch and on every return to the foreground, pending purchases (cash, Ask to Buy) reported and left alone until paid; prices come from the store's product records, the app carries only the product ids (`src/features/support/tips.ts`) |
| Ads | `react-native-google-mobile-ads` | one rewarded ad, only in the support sheet and only when asked for (`src/features/support/useRewardedSupportAd.ts`); Google's consent flow (UMP) runs before the first request and decides between personalised and non-personalised requests, the SDK initialises after it (`delayAppMeasurementInit`); the AdMob app ids reach the native manifests through the plugin in `app.config.ts`, the rewarded units come from `EXPO_PUBLIC_ADMOB_REWARDED_*_UNIT_ID`, and without one a development build shows Google's test ad while a release build offers no ad |
| Fonts | `expo-font` + `@expo-google-fonts/*` | Cormorant Garamond and Cinzel Decorative, imported per weight; the repository's woff2 files cannot be used natively |
| Locale | `expo-localization` | the device language picks the dictionary and, through `detectCountry`, the map's home country (never geolocation) |
| Country names | `@formatjs/intl-displaynames` | Hermes has no `Intl.DisplayNames`; the polyfill with Polish and English data names a cottage's country in the map panel, as the site does |
| Release size | `expo-build-properties` | R8 and resource shrinking in Android release builds (`enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`): the Java/Kotlin code drops from 55 MB to about 21 MB before packaging; the native libraries ship their own keep rules, so no rules of ours |
| Locale filter | `plugins/with-locale-filters.js` | config plugin that writes the Android Gradle plugin's `localeFilters` from `expo.locales` in app.json, so the libraries' strings in the other eighty languages stay out of the APK (Google Play does the same split from an app bundle) |
| Scene life cycle | `plugins/with-scene-delegate.js` | config plugin for the iOS 27 SDK, which asserts at launch unless the app adopts UIScene: the generated `AppDelegate` conforms to `ExpoReactNativeFactoryProvider` and stops starting React Native itself, a `SceneDelegate` subclasses Expo's `ExpoAppSceneDelegate` (it creates the window and starts React Native from the scene), and `Info.plist` gets the `UIApplicationSceneManifest`; idempotent, skipped from SDK 58 on (the template adopts scenes itself), refuses an expo older than 57.0.25 |

Sign-in setup lives in `supabase/README.md` (the Google and Apple
providers, their client ids, the Supabase side). On the app's side
everything comes from `.env` through `app.config.ts`, and a change there is
followed by a native rebuild: the Google sign-in plugin joins the build with
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` read backwards as its iOS URL scheme (the
plugin refuses to run without one); Sign in with Apple, the capability on
the App ID (`ios.usesAppleSignIn`) and the `expo-apple-authentication`
plugin, is in every build unless `EXPO_PUBLIC_APPLE_SIGN_IN=0`, which a free
Personal Team sets because it cannot sign the capability; `APPLE_TEAM_ID`
names the team that signs device builds.

TODO universal links: the plaque QR carries `https://www.chatynkowo.pl/?kod=NNNN`. The Android half is in place (`android.intentFilters` for `https://www.chatynkowo.pl/`, `/index.html` and `https://chatynkowo.pl/` with `autoVerify`; it stays a plain browser choice until the site serves `/.well-known/assetlinks.json` with `delegate_permission/common.handle_all_urls` for `com.blockchainwares.app.mysterious.cottages` and the release signing SHA-256). The iOS half is not: add `ios.associatedDomains: ["applinks:www.chatynkowo.pl", "applinks:chatynkowo.pl"]` to `app.json` only once the site serves `/.well-known/apple-app-site-association` (applinks for `<TEAMID>.com.blockchainwares.app.mysterious.cottages` with components for `/` and `/index.html` carrying a `kod` or `code` query, so `ranking.html` share links keep opening the website), because the Associated Domains capability changes device code signing. `app/+native-intent.tsx` already maps both URL forms to the code sheet.

## Conventions

- Icons come only from `src/ui/icons.ts`, which mirrors the web vocabulary
  name for name (`CloseIcon`, `ChronicleIcon`, ...) and the `iconSize`
  scale; the role names are the theme's `SHARED_ICON_ROLES` and
  `MOBILE_ICON_ROLES`, checked at compile time. `phosphor-react-native` is
  imported nowhere else, and only through its per-icon entries
  (`phosphor-react-native/src/icons/<Name>`): Metro does not tree-shake,
  and the package root would put all 1500 icons in the bundle. Those
  entries are sources, so the type check needs Expo's augmentations
  (`src/types/expo.d.ts` keeps the reference in every checkout; the
  generated `expo-env.d.ts` is ignored). No emoji or typographic glyph is
  used as an icon. `scripts/check-conventions.mjs` enforces all of this as
  part of `pnpm check`.
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

## Supporting Chatynkowo

The app is free and stays free; the support sheet (`app/support.tsx`,
`src/features/support/`) offers two voluntary ways to help, side by side
and equal, and says plainly that neither unlocks anything:

- **A coffee for the elf.** A consumable in-app product per size (the
  product ids in `TIP_MENU`, `tips.ts`: `coffee_small`, `coffee_regular`,
  `coffee_large`, `coffee_pot`), bought through the store the app came
  from, so the payment never leaves the app and the stores' billing rules
  are met on both platforms. The sheet shows the names from the dictionary
  with the prices the store reports, in the player's currency; the store's
  own payment sheet takes the payment. `src/lib/billing.ts` is the only
  module that talks to the store (expo-iap over Play Billing and StoreKit
  2) and `SupportProvider` drives it from the app's start: the purchase
  listeners are in place before the connection opens and stay for the
  life of the app; a purchase the store reports as paid is finished at
  once (consumed on Android, finished on iOS) and only then counted;
  purchases left unfinished by a crash are settled at launch and on
  every return to the foreground (Google refunds a purchase not
  acknowledged within three days, Apple keeps re-sending an unfinished
  one); a pending purchase (a cash payment, Ask to Buy) is reported in the
  sheet and left alone until the store says it is paid; a cancelled
  payment is silent, a failed one is reported with nothing charged. There
  is no receipt verification on a server: a coffee grants nothing, so
  there is no entitlement to protect; should one ever be attached to it,
  the purchase goes through an Edge Function (Google Play Developer API,
  App Store Server API) before it is finished. A device without a working
  store (an emulator without Play, a build whose products are not yet
  published) shows the coffee as unavailable.
- **A rewarded ad.** The only ad in the app, shown only here and only when
  the player asks (`useRewardedSupportAd.ts`): the consent flow first
  (Google's User Messaging Platform; in the EEA the message configured in
  the AdMob account, once), then the SDK, then one ad loaded and shown;
  the ad network's word that it was watched to the end is the support. A
  consent flow that fails (no message configured yet, no network) falls
  back to non-personalised requests; consent required and not given means
  no ad. The sheet reports where a request stands (looking, no ad right
  now, offline, interrupted, refused).

Either way the receipt is the provider's and the same: the ledger on the
device counts it (`src/lib/support-store.ts`, shown in the sheet as "your
support so far"), a toast says thanks and the sheet closes. No haptic: the
phone stirs only for a discovery (`src/lib/haptics.ts`).

The sheet is never pushed on anyone; it is opened by the support
invitations, one component (`src/features/support/SupportCard.tsx`)
mounted where a player has just received something: a card at the end of
every tale, under the story; a card under the collection in the Kronika; a
line on the celebration card after a reward; and a card in the profile,
right under the account block. Each says in its own words that Chatynkowo
is free and that a coffee or a moment for an ad is a choice, not a
condition, and opens `/support`. Once the device's ledger records the
first support, every card turns into a thank-you that still opens the
sheet and the celebration's line disappears, so a player who has given is
not asked again, only reminded where the sheet is.

### Setting the stores up

The code is complete; what remains is configuration in the consoles, none
of it in the repository:

1. **Google Play Console**, the app `com.blockchainwares.app.mysterious.cottages` (it must exist,
   with a signed build uploaded to at least an internal testing track;
   Play Billing refuses an app it does not know): under Monetize, In-app
   products, create the four products with exactly the ids above, type
   one-time (consumable is the app's choice at purchase time), a name, a
   description and a price each (the sheet suggests small, regular, large
   and a pot: for instance 4.99, 9.99, 19.99 and 49.99 PLN), then
   activate them. To test without being charged, add the testers' Google
   accounts under Setup, License testing, and install the build from the
   testing track or sign the local build with the upload key.
2. **App Store Connect**, the app with the bundle id `com.blockchainwares.app.mysterious.cottages`:
   under In-App Purchases, create the four products as Consumable with
   the same product ids, a reference name, a price tier each and the
   localized display names; submit them with the first build that offers
   them (the review needs a screenshot of the sheet). The In-App Purchase
   capability is on the App ID automatically once products exist. To test
   on a device, create a Sandbox tester under Users and Access and sign
   in to it in Settings, App Store; in Xcode a StoreKit configuration file
   with the same ids lets the simulator sell them.
3. **AdMob**: an app per platform with the ids put into `.env`
   (`EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_IOS_APP_ID`,
   followed by a native rebuild), one rewarded ad unit per platform in
   `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` /
   `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID`, and a GDPR message under
   Privacy & messaging, which the consent form shows in the EEA. The app
   asks for no App Tracking Transparency permission on iOS (the plugin
   gets no `userTrackingUsageDescription`), so iOS serves ads without the
   advertising identifier. If the iOS build ever complains about the
   Google Mobile Ads pod and frameworks, the library's answer is
   `ios.useFrameworks: "static"` in the `expo-build-properties` plugin;
   the Android build needs nothing beyond the plugin.
4. **Store listings**: both stores ask that the app's privacy policy
   mentions the ads (AdMob) and the purchases; the Data safety form on
   Play and the App Privacy answers on the App Store list the advertising
   identifier and the purchase history accordingly.
