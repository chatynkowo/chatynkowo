import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router'
import { useTranslation } from 'react-i18next'
import '../src/i18n'
import { restoreLanguage } from '../src/i18n'
import { AchievementToast } from '../src/features/kronika/AchievementToast'
import { ContentProvider, ProgressProvider, SessionProvider } from '../src/providers'
import { colors, fonts, useAppFonts } from '../src/ui'

/* The root of the app: fonts and the remembered language load behind the
   splash screen, then the providers (account, content, progress) wrap a
   native stack whose first screen is the tab bar and whose other screens
   are presented as modals on top of it. New top-level surfaces (the elf
   companion's cottage, say) are added here as further Stack.Screen entries,
   and new tabs in (tabs)/_layout.tsx. */

void SplashScreen.preventAutoHideAsync()

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
    bold: { fontFamily: fonts.bold, fontWeight: '700' as const },
    heavy: { fontFamily: fonts.display, fontWeight: '800' as const },
  },
}

export default function RootLayout() {
  const { t } = useTranslation()
  const [fontsLoaded, fontError] = useAppFonts()
  const [languageReady, setLanguageReady] = useState(false)

  useEffect(() => {
    void restoreLanguage().finally(() => setLanguageReady(true))
  }, [])

  const ready = (fontsLoaded || Boolean(fontError)) && languageReady

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <ThemeProvider value={theme}>
      <SessionProvider>
        <ContentProvider>
          <ProgressProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="story/[slug]" options={{ presentation: 'modal', title: t('nav.notebook') }} />
              <Stack.Screen name="reward/[id]" options={{ presentation: 'modal', title: t('quest.chronicle') }} />
              <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', title: t('mobile:code.scanTitle') }} />
              <Stack.Screen name="profile" options={{ presentation: 'modal', title: t('mobile:profile.title') }} />
            </Stack>
            <AchievementToast />
          </ProgressProvider>
        </ContentProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
