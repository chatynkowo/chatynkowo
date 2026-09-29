import type { ReactNode } from 'react'
import { Platform } from 'react-native'

/* iOS 26 draws its own glass edge under a transparent bar; older systems
   get the chrome material so the bar reads over the scrolling content. */
const IOS_MAJOR = Platform.OS === 'ios' ? Number(String(Platform.Version).split('.')[0]) : 0
import { Stack, type NativeStackNavigationOptions } from 'expo-router'
import { colors, fonts } from './tokens'

/* The native stack inside a tab (Kronika, Ranking, Profile): one header
   recipe so the three bars match. iOS gets a transparent bar with the
   system's glass edge effect and a standard title in the display face (a
   large title stays blank inside the native tab bar on iOS 26, whatever the
   bar's background, so it is not used); Android gets a page-coloured top
   app bar. Screens pushed inside a tab take `tabChildOptions`, which today
   adds nothing beyond the native back button. */

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

/* A screen one level down: the native back button, nothing else. */
export const tabChildOptions: NativeStackNavigationOptions = {}

export function TabStack({ children }: { children?: ReactNode }) {
  return <Stack screenOptions={tabStackScreenOptions}>{children}</Stack>
}
