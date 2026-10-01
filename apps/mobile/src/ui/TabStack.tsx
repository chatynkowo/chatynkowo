import type { ReactNode } from 'react'
import { Platform, type PlatformIOSStatic } from 'react-native'
import { Stack, type NativeStackNavigationOptions } from 'expo-router'
import { colors, fonts } from './tokens'

/* iOS 26 draws its own glass edge under a transparent bar; older systems
   get the chrome material so the bar reads over the scrolling content. */
const IOS_MAJOR = Platform.OS === 'ios' ? Number(String(Platform.Version).split('.')[0]) : 0

/* The height of a native stack bar without the status bar: the compact
   bar of iOS (taller on the iPad), the top app bar of Android. The
   navigator does not publish it, so screens whose content runs under a
   transparent bar (the scanner's aim, the story's title threshold) keep
   this much clear; an Android tablet's bar is 8 dp taller, which those two
   uses tolerate. */
const isPad = Platform.OS === 'ios' && (Platform as PlatformIOSStatic).isPad
export const NATIVE_HEADER_HEIGHT = Platform.select({ ios: isPad ? 50 : 44, default: 56 })

/* The native stack inside a tab (Kronika, Ranking, Profile): one header
   recipe so the three bars match. iOS gets a transparent bar with the
   system's glass edge effect and a standard title in the display face (a
   large title stays blank inside the native tab bar on iOS 26, whatever the
   bar's background, so it is not used); Android gets a page-coloured top
   app bar. A screen that cannot scroll under a transparent bar (the
   guide's pager) takes `opaqueHeaderOptions` on top. */

const titleStyle = { fontFamily: fonts.display, color: colors.ink }

export const tabStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  headerTintColor: colors.accentStrong,
  headerTitleStyle: titleStyle,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.page },
  ...Platform.select<NativeStackNavigationOptions>({
    ios: {
      headerTransparent: true,
      ...(IOS_MAJOR < 26 ? { headerBlurEffect: 'systemChromeMaterialDark' as const } : {}),
    },
    default: {
      headerStyle: { backgroundColor: colors.page },
    },
  }),
}

/* An opaque bar in the page colour where the content cannot slide under
   a transparent one; Android's bar is opaque already. */
export const opaqueHeaderOptions: NativeStackNavigationOptions = Platform.select<NativeStackNavigationOptions>({
  ios: { headerTransparent: false, headerBlurEffect: undefined, headerStyle: { backgroundColor: colors.page } },
  default: {},
})

export function TabStack({ children }: { children?: ReactNode }) {
  return <Stack screenOptions={tabStackScreenOptions}>{children}</Stack>
}
