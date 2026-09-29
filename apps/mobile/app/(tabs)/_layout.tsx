import { Platform, type ColorValue } from 'react-native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { Tabs } from 'expo-router/js-tabs'
import { useTranslation } from 'react-i18next'
import { useCelebrationPresenter } from '../../src/features/atlas/useCelebrationPresenter'
import { haptic } from '../../src/lib/haptics'
import { useProgress } from '../../src/providers'
import { TAB_ICONS, colors, fonts, sizes, type Icon } from '../../src/ui'

/* The expedition loop as four native tabs: the Atlas (the play field),
   the Kronika (the collection), the Ranking and the Profile. Icons are the
   platform symbols declared in the vocabulary (SF Symbols on iOS, Material
   on Android), labels come from the "mobile" namespace, and two badges come
   from progress: seals not yet viewed on the Kronika, finds not yet saved to
   the account on the Profile (a badge is mounted only while its count is
   above zero; the native bar shows a hidden badge as 0). Adding a tab is one more Trigger here plus a
   folder (with a Stack _layout) or a file in this directory. */

/* Rollback switch: false renders the previous JS tab bar (JsTabsLayout
   below, Phosphor glyphs) until the native bar is proven in a release. */
const USE_NATIVE_TABS = true

/* iOS 26 gives the bar its own glass; a blur on top of it is a second
   full-screen effect the phone renders for nothing. Older systems keep the
   chrome material so the bar reads over the content. */
const IOS_MAJOR = Platform.OS === 'ios' ? Number(String(Platform.Version).split('.')[0]) : 0

export default function TabsLayout() {
  return (
    <>
      <CelebrationPresenter />
      {USE_NATIVE_TABS ? <NativeTabsLayout /> : <JsTabsLayout />}
    </>
  )
}

/* The reward card after a story, presented over whichever tab is showing. */
function CelebrationPresenter() {
  useCelebrationPresenter()
  return null
}

function NativeTabsLayout() {
  const { t } = useTranslation()
  const { unseenRewards, pendingCount } = useProgress()

  return (
    <NativeTabs
      tintColor={colors.accentStrong}
      iconColor={{ default: colors.inkFaint, selected: colors.accentStrong }}
      backgroundColor={colors.pageRaised}
      labelStyle={{ fontFamily: fonts.semibold, fontSize: 12 }}
      badgeBackgroundColor={colors.accent}
      badgeTextColor={colors.accentInk}
      blurEffect={IOS_MAJOR < 26 ? 'systemChromeMaterialDark' : undefined}
      minimizeBehavior="onScrollDown"
      shadowColor={colors.line}
      rippleColor={colors.accentWash}
      indicatorColor={colors.accentWash}
      labelVisibilityMode="labeled"
      backBehavior="initialRoute"
      screenListeners={{ tabPress: () => haptic('select') }}
    >
      {/* The Atlas is full-bleed and places its own chrome above the bar. */}
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>{t('mobile:tabs.atlas')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={TAB_ICONS.index.sf} md={TAB_ICONS.index.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="kronika">
        <NativeTabs.Trigger.Label>{t('mobile:tabs.kronika')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={TAB_ICONS.kronika.sf} md={TAB_ICONS.kronika.md} />
        {unseenRewards.length > 0 ? <NativeTabs.Trigger.Badge>{String(unseenRewards.length)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ranking">
        <NativeTabs.Trigger.Label>{t('mobile:tabs.ranking')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={TAB_ICONS.ranking.sf} md={TAB_ICONS.ranking.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('mobile:tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={TAB_ICONS.profile.sf} md={TAB_ICONS.profile.md} />
        {pendingCount > 0 ? <NativeTabs.Trigger.Badge>{String(pendingCount)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

/* ---------- Rollback: the JS tab bar ---------- */

function tabIcon(Glyph: Icon) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Glyph color={String(color)} size={size} weight={focused ? 'fill' : 'regular'} />
  )
}

function badge(count: number) {
  return count > 0 ? count : undefined
}

function JsTabsLayout() {
  const { t } = useTranslation()
  const { unseenRewards, pendingCount } = useProgress()

  return (
    <Tabs
      backBehavior="initialRoute"
      screenListeners={{ tabPress: () => haptic('select') }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.pageRaised, borderTopColor: colors.line, height: sizes.tabBar, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 13 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.accentInk, fontFamily: fonts.semibold },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('mobile:tabs.atlas'), tabBarIcon: tabIcon(TAB_ICONS.index.Glyph) }} />
      <Tabs.Screen
        name="kronika"
        options={{ title: t('mobile:tabs.kronika'), tabBarIcon: tabIcon(TAB_ICONS.kronika.Glyph), tabBarBadge: badge(unseenRewards.length) }}
      />
      <Tabs.Screen name="ranking" options={{ title: t('mobile:tabs.ranking'), tabBarIcon: tabIcon(TAB_ICONS.ranking.Glyph) }} />
      <Tabs.Screen
        name="profile"
        options={{ title: t('mobile:tabs.profile'), tabBarIcon: tabIcon(TAB_ICONS.profile.Glyph), tabBarBadge: badge(pendingCount) }}
      />
    </Tabs>
  )
}
