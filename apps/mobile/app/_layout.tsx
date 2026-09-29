import { useEffect, useState, type ReactNode } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { FullWindowOverlay } from 'react-native-screens'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { DarkTheme, Stack, ThemeProvider, useRootNavigationState, useRouter, type NativeStackNavigationOptions } from 'expo-router'
import { useTranslation } from 'react-i18next'
import '../src/i18n'
import { bootstrap, type BootResult } from '../src/lib/bootstrap'
import {
  BootProvider,
  ContentProvider,
  NetworkProvider,
  ProgressProvider,
  SessionProvider,
  ToastProvider,
  useBoot,
  useContent,
  useProgress,
  useToast,
} from '../src/providers'
import { ToastHost, colors, fonts, headerRightItems, radius, useAppFonts } from '../src/ui'

/* The root of the app. Fonts and the bootstrap (language, progress, cached
   content, flags) load behind the native splash, which then fades into a
   fully formed first frame: the onboarding pager on a fresh install, the
   Atlas with cached pins later. The providers (boot, network, account,
   content, progress, toasts) wrap a native stack whose gated first screens
   are the welcome pager and the tab bar, and whose other screens are
   sheets and modals presented on top. New top-level surfaces are added
   here as further Stack.Screen entries, new tabs in (tabs)/_layout.tsx. */

void SplashScreen.preventAutoHideAsync()

/* A cold deep link (a plaque code, a reward) opens over the tabs rather
   than as the only screen of the stack, which would leave a sheet with
   nothing beneath it and no way back. On a fresh install the guard keeps
   the tabs out and the onboarding takes the link instead. */
export const unstable_settings = { anchor: '(tabs)' }

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.page,
    card: colors.pageRaised,
    text: colors.ink,
    border: colors.line,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily: fonts.body, fontWeight: '400' as const },
    medium: { fontFamily: fonts.semibold, fontWeight: '500' as const },
    bold: { fontFamily: fonts.semibold, fontWeight: '700' as const },
    heavy: { fontFamily: fonts.display, fontWeight: '800' as const },
  },
}

const SPLASH_FADE_MS = 300

const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.page },
  headerTintColor: colors.accentStrong,
  headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
  headerBackButtonDisplayMode: 'minimal',
}

/* A bottom sheet sized to its content: code entry, reward, rules. */
const fitSheet: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
  sheetCornerRadius: radius.card,
  headerShown: false,
  contentStyle: { backgroundColor: colors.pageRaised },
}

/* Transparent, blurred bar on iOS; an opaque page-coloured bar on Android,
   where blur does not exist and the content starts beneath the bar. */
const modalHeader = Platform.select<NativeStackNavigationOptions>({
  ios: { headerTransparent: true, headerBlurEffect: 'systemChromeMaterialDark' },
  default: { headerStyle: { backgroundColor: colors.page } },
})

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <BootGate>
          <AppShell />
        </BootGate>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

/* Nothing renders until the fonts and the bootstrap are in (the storage
   reads are capped at 1500 ms, the fonts are waited for); then the splash
   fades over the first real frame. The root view colour is set once here,
   which also exercises the window hand-off of the scene delegate. */
function BootGate({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useAppFonts()
  const [boot, setBoot] = useState<BootResult | null>(null)

  useEffect(() => {
    let current = true
    void bootstrap().then((result) => {
      if (current) setBoot(result)
    })
    return () => {
      current = false
    }
  }, [])

  const ready = (fontsLoaded || Boolean(fontError)) && boot !== null

  useEffect(() => {
    if (!ready) return
    void SystemUI.setBackgroundColorAsync(colors.page)
    SplashScreen.setOptions({ fade: true, duration: SPLASH_FADE_MS })
    void SplashScreen.hideAsync()
  }, [ready])

  if (!ready || !boot) return null

  return <BootProvider initial={boot}>{children}</BootProvider>
}

function AppShell() {
  const { initial } = useBoot()
  return (
    <NetworkProvider>
      <SessionProvider>
        <ContentProvider initial={initial}>
          <ProgressProvider initial={initial}>
            <ToastProvider>
              <StatusBar style="light" />
              <RootStack />
              <PendingHref />
              <BackfillToast />
              <Toasts />
            </ToastProvider>
          </ProgressProvider>
        </ContentProvider>
      </SessionProvider>
    </NetworkProvider>
  )
}

/* On iOS every sheet and modal is presented by UIKit above the root view,
   so the toast pill lives in a window overlay (with its own gesture root)
   to stay visible over them; Android draws its modals in the same view. */
function Toasts() {
  if (Platform.OS !== 'ios') return <ToastHost />
  return (
    <FullWindowOverlay>
      <GestureHandlerRootView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <ToastHost />
      </GestureHandlerRootView>
    </FullWindowOverlay>
  )
}

function RootStack() {
  const { t } = useTranslation()
  const router = useRouter()
  const { welcomeSeen } = useBoot()

  /* Modals close back to whatever is beneath, or to the Atlas (the
     onboarding on a fresh install) when they were the entry point of a
     cold deep link. */
  const closeModal = () => {
    if (router.canGoBack()) router.back()
    else router.replace(welcomeSeen ? '/' : '/welcome')
  }

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Protected guard={!welcomeSeen}>
        <Stack.Screen name="welcome" options={{ presentation: 'card', animation: 'fade', headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={welcomeSeen}>
        <Stack.Screen name="(tabs)" options={{ presentation: 'card', animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="code" options={fitSheet} />
      <Stack.Screen
        name="scan"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          headerShown: true,
          headerTransparent: true,
          headerTitle: t('mobile:code.scanTitle'),
          headerTitleStyle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17 },
          headerTintColor: colors.ink,
          headerBackVisible: false,
          gestureEnabled: false,
          /* The screen adds the torch item next to this one once it knows
             the torch state. */
          ...headerRightItems([{ role: 'close', label: t('mobile:common.close'), onPress: closeModal }]),
        }}
      />
      {/* A page sheet, not a form sheet with detents: on iOS 26 the detent
          sheet scrolls its list out of view when the keyboard rises for the
          search field, and the page sheet handles the keyboard itself. */}
      <Stack.Screen
        name="search"
        options={{
          presentation: 'modal',
          headerShown: false,
          contentStyle: { backgroundColor: colors.pageRaised },
        }}
      />
      <Stack.Screen
        name="story/[slug]"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          sheetGrabberVisible: true,
          headerShown: true,
          ...modalHeader,
          /* Empty until the hero scrolls under the bar; the screen sets the
             cottage title through navigation.setOptions. */
          headerTitle: '',
          headerBackVisible: false,
          ...headerRightItems([{ role: 'close', label: t('story.closeAria'), onPress: closeModal }]),
        }}
      />
      <Stack.Screen
        name="celebrate"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="reward/[id]" options={fitSheet} />
      <Stack.Screen name="rules" options={fitSheet} />
    </Stack>
  )
}

/* The onboarding leaves a route behind ("Wpisz kod", a plaque link on a
   fresh install). It is pushed once the guard has flipped and the tabs are
   in the navigation state, one frame later so the Protected swap settles. */
function PendingHref() {
  const router = useRouter()
  const { welcomeSeen, pendingHref, setPendingHref } = useBoot()
  const rootState = useRootNavigationState()
  const tabsMounted = Boolean(rootState?.routes?.some((route) => route.name === '(tabs)'))

  useEffect(() => {
    if (!welcomeSeen || !pendingHref || !tabsMounted) return
    const href = pendingHref
    setPendingHref(null)
    requestAnimationFrame(() => router.push(href))
  }, [welcomeSeen, pendingHref, tabsMounted, router, setPendingHref])

  return null
}

/* A level awarded by a content update (never by a live find) joins the
   Kronika badge and announces itself with a toast that opens the reward. */
function BackfillToast() {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const { onBackfill } = useProgress()
  const { rewards } = useContent()

  useEffect(
    () =>
      onBackfill((ids) => {
        const id = ids[ids.length - 1]
        if (!id) return
        const level = rewards.levels.find((candidate) => candidate.id === id)
        toast.show({
          tone: 'success',
          text: t('achievement.newReward', { name: level?.name ?? id }),
          action: {
            label: t('quest.chronicleOpen'),
            onPress: () => router.push({ pathname: '/reward/[id]', params: { id, earned: '1' } }),
          },
        })
      }),
    [onBackfill, rewards.levels, toast, t, router],
  )

  return null
}
