import { useEffect, useMemo } from 'react'
import { Tabs, type BottomTabBarProps, type BottomTabNavigationOptions } from 'expo-router/js-tabs'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCelebrationPresenter } from '../../src/features/atlas/useCelebrationPresenter'
import { useBoot, useProgress } from '../../src/providers'
import { TAB_ICONS, TabBar, colors, type DiscoverAction, type Icon } from '../../src/ui'

/* The expedition loop as four tabs around one raised action: the Atlas
   (the play field), the Kronika (the collection), the Ranking and the
   Profile, with the gold "discover" button in the middle of the bar opening
   the code sheet (a press) or the scanner (a long press). The bar is the
   app's own (src/ui/TabBar.tsx) so the button can rise above it; it floats
   over the tab screens, which read its height through useTabBarHeight().
   Icons are the vocabulary's tab glyphs, labels come from the "mobile"
   namespace, and the Kronika carries the badge of seals not yet viewed
   (mounted only while the count is above zero). The layout also hosts the
   two things that must act once the tabs are in the navigation state: the
   celebration presenter and the route the onboarding left behind. Adding a
   tab is one more Tabs.Screen here plus a folder (with a Stack _layout) or
   a file in this directory. */

export default function TabsLayout() {
  const { t } = useTranslation()
  const router = useRouter()
  const { unseenRewards } = useProgress()

  const discover = useMemo<DiscoverAction>(
    () => ({
      label: t('mobile:tabs.discover'),
      accessibilityLabel: t('mobile:tabs.discoverAria'),
      scanLabel: t('mobile:code.scan'),
      onPress: () => router.push('/code'),
      onLongPress: () => router.push('/scan'),
    }),
    [t, router],
  )

  return (
    <>
      <CelebrationPresenter />
      <PendingHref />
      <Tabs
        backBehavior="initialRoute"
        tabBar={(props: BottomTabBarProps) => <TabBar {...props} discover={discover} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.page } }}
      >
        <Tabs.Screen name="index" options={{ title: t('mobile:tabs.atlas'), tabBarIcon: tabIcon(TAB_ICONS.index.Glyph) }} />
        <Tabs.Screen
          name="kronika"
          options={{ title: t('mobile:tabs.kronika'), tabBarIcon: tabIcon(TAB_ICONS.kronika.Glyph), tabBarBadge: badge(unseenRewards.length) }}
        />
        <Tabs.Screen name="ranking" options={{ title: t('mobile:tabs.ranking'), tabBarIcon: tabIcon(TAB_ICONS.ranking.Glyph) }} />
        <Tabs.Screen name="profile" options={{ title: t('mobile:tabs.profile'), tabBarIcon: tabIcon(TAB_ICONS.profile.Glyph) }} />
      </Tabs>
    </>
  )
}

/* The reward card after a story, presented over whichever tab is showing. */
function CelebrationPresenter() {
  useCelebrationPresenter()
  return null
}

/* The onboarding leaves a route behind ("Wpisz kod", a plaque link on a
   fresh install). Mounted here, the tabs are in the navigation state by
   definition; the push waits one frame so the Protected swap settles. */
function PendingHref() {
  const router = useRouter()
  const { pendingHref, setPendingHref } = useBoot()

  useEffect(() => {
    if (!pendingHref) return
    const href = pendingHref
    setPendingHref(null)
    requestAnimationFrame(() => router.push(href))
  }, [pendingHref, router, setPendingHref])

  return null
}

/* The vocabulary glyph of a tab: outline idle, filled when selected. */
function tabIcon(Glyph: Icon): BottomTabNavigationOptions['tabBarIcon'] {
  return ({ color, size, focused }) => <Glyph color={String(color)} size={size} weight={focused ? 'fill' : 'regular'} />
}

function badge(count: number) {
  return count > 0 ? count : undefined
}
