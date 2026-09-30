import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Stack, type NativeStackNavigationOptions } from 'expo-router'
import { TabStack, tabChildOptions } from '../../../src/ui'
import { colors } from '../../../src/ui'

/* The Profile tab's own stack: the settings list under a large title, with
   About and How to play pushed on top under a standard title and the native
   back button. Titles are read here so they follow the language switch. */

/* The guide is a fixed pager (pages, dots), not a scroll view, so
   its content cannot slide under a transparent bar: the bar is opaque. */
const guideOptions: NativeStackNavigationOptions = {
  ...tabChildOptions,
  ...Platform.select<NativeStackNavigationOptions>({
    ios: { headerTransparent: false, headerBlurEffect: undefined, headerStyle: { backgroundColor: colors.page } },
    default: {},
  }),
}

export default function ProfileLayout() {
  const { t } = useTranslation()
  return (
    <TabStack>
      <Stack.Screen name="index" options={{ title: t('mobile:tabs.profile') }} />
      <Stack.Screen name="about" options={{ ...tabChildOptions, title: t('nav.about') }} />
      <Stack.Screen name="guide" options={{ ...guideOptions, title: t('mobile:profile.howToPlay') }} />
    </TabStack>
  )
}
