import type { ColorValue } from 'react-native'
import { Tabs } from 'expo-router/js-tabs'
import { useTranslation } from 'react-i18next'
import { AtlasIcon, ChronicleIcon, KeyIcon, RewardIcon, colors, fonts, sizes, type Icon } from '../../src/ui'

/* The expedition loop as four tabs. A tab's icon comes from the vocabulary
   and its title from the "mobile" namespace; adding a tab is one more
   Tabs.Screen here plus a file in this directory. */

function tabIcon(Glyph: Icon) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Glyph color={String(color)} size={size} weight={focused ? 'fill' : 'regular'} />
  )
}

export default function TabsLayout() {
  const { t } = useTranslation()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.pageRaised, borderTopColor: colors.line, height: sizes.tabBar, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 13 },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('mobile:tabs.atlas'), tabBarIcon: tabIcon(AtlasIcon) }} />
      <Tabs.Screen name="code" options={{ title: t('mobile:tabs.code'), tabBarIcon: tabIcon(KeyIcon) }} />
      <Tabs.Screen name="kronika" options={{ title: t('mobile:tabs.kronika'), tabBarIcon: tabIcon(ChronicleIcon) }} />
      <Tabs.Screen name="ranking" options={{ title: t('mobile:tabs.ranking'), tabBarIcon: tabIcon(RewardIcon) }} />
    </Tabs>
  )
}
