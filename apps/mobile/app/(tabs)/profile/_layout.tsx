import { useTranslation } from 'react-i18next'
import { Stack } from 'expo-router'
import { TabStack, opaqueHeaderOptions } from '../../../src/ui'

/* The Profile tab's own stack: the settings list under a standard title,
   with About and How to play pushed on top under their own titles and the
   native back button. Titles are read here so they follow the language
   switch. The guide is a fixed pager (pages, dots), not a scroll view, so
   its content cannot slide under a transparent bar: the bar is opaque. */
export default function ProfileLayout() {
  const { t } = useTranslation()
  return (
    <TabStack>
      <Stack.Screen name="index" options={{ title: t('mobile:tabs.profile') }} />
      <Stack.Screen name="about" options={{ title: t('nav.about') }} />
      <Stack.Screen name="guide" options={{ ...opaqueHeaderOptions, title: t('mobile:profile.howToPlay') }} />
    </TabStack>
  )
}
