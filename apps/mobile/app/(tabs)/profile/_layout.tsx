import { useTranslation } from 'react-i18next'
import { Stack } from 'expo-router'
import { TabStack, opaqueHeaderOptions } from '../../../src/ui'

/* The Profile tab's own stack: the settings list under a standard title,
   with the account screen, About and How to play pushed on top under their
   own titles and the native back button. Titles are read here so they follow the language
   switch. The guide is a fixed pager (pages, dots), not a scroll view, so
   its content cannot slide under a transparent bar: the bar is opaque. */
/* The list stays under the account screen also when a link lands on the
   account first: without the anchor the stack would begin at the account
   screen, with no back button and nothing to pop to after a sign-out. A
   navigation from another tab asks for the same with `withAnchor` (the
   Ranking's "Account" button). */
export const unstable_settings = { anchor: 'index' }

export default function ProfileLayout() {
  const { t } = useTranslation()
  return (
    <TabStack>
      <Stack.Screen name="index" options={{ title: t('mobile:tabs.profile') }} />
      <Stack.Screen name="account" options={{ title: t('mobile:profile.accountTitle') }} />
      <Stack.Screen name="about" options={{ title: t('nav.about') }} />
      <Stack.Screen name="guide" options={{ ...opaqueHeaderOptions, title: t('mobile:profile.howToPlay') }} />
    </TabStack>
  )
}
