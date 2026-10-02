import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { StoryBody } from '../../src/features/story/StoryBody'
import { HERO_ASPECT, HERO_UNDER_BAR, StoryHero } from '../../src/features/story/StoryHero'
import { announce } from '../../src/lib/announce'
import { haptic } from '../../src/lib/haptics'
import { useCloseModal, useContent, useProgress } from '../../src/providers'
import { Button, NATIVE_HEADER_HEIGHT, Screen, Text, colors, sizes, space, withAlpha } from '../../src/ui'

/* A cottage's tale, presented as a modal: the first time straight from the
   code gate with the unlock ceremony (`unlocked=1`), later from the Atlas as
   a plain revisit. One body serves both. The gate above it never exposes a
   tale for a cottage that has not been found: such a link lands on the
   cottage's clue in the Atlas instead. */

/* Room under the sticky button so the tale's last lines clear it. */
const STICKY_CLEARANCE = sizes.button + space.xl * 2
const STICKY_FADE_HEIGHT = 24

/* The page colour made transparent, for the fade above the sticky button. */
const STICKY_GRADIENT = [withAlpha(colors.page, 0), colors.page] as const

export default function StoryScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { slug, unlocked } = useLocalSearchParams<{ slug: string; unlocked?: string }>()
  const { cottageBySlug } = useContent()
  const { foundSlugs } = useProgress()
  const cottage = cottageBySlug(slug)
  const found = foundSlugs.has(slug)

  /* A tale that has not been found lands on its clue in the Atlas: back to
     the tabs already beneath (a fresh copy would stack a second Atlas), or
     the Atlas in this screen's place when the link was the entry point. */
  useEffect(() => {
    if (cottage && !found) router.dismissTo({ pathname: '/', params: { focus: slug } })
  }, [cottage, found, slug, router])

  if (!cottage) {
    return (
      <Screen>
        <Text variant="heading" accessibilityRole="header">
          {t('mobile:story.notFound')}
        </Text>
        <Text tone="soft">{t('atlas.errorBody')}</Text>
      </Screen>
    )
  }
  if (!found) return null

  return <StoryView cottage={cottage} ceremony={unlocked === '1'} />
}

function StoryView({ cottage, ceremony }: { cottage: Cottage; ceremony: boolean }) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { state, celebration, requestCelebration } = useProgress()
  const { rewards } = useContent()
  const scrollY = useSharedValue(0)
  const [titleShown, setTitleShown] = useState(false)

  const heroHeight = Math.round(width / HERO_ASPECT)
  /* The bar takes the title once the hero has scrolled out from under it
     (a page sheet sits below the status bar, so the bar is its own height). */
  const titleThreshold = heroHeight - (HERO_UNDER_BAR ? NATIVE_HEADER_HEIGHT : 0)

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })

  useAnimatedReaction(
    () => scrollY.value > titleThreshold,
    (show, previous) => {
      if (show !== previous) scheduleOnRN(setTitleShown, show)
    },
    [titleThreshold],
  )

  useEffect(() => {
    navigation.setOptions({ headerTitle: titleShown ? cottage.title : '' })
  }, [navigation, titleShown, cottage.title])

  useEffect(() => {
    if (ceremony) announce(`${t('story.unlocked')}. ${cottage.title}`)
  }, [ceremony, cottage.title, t])

  const close = useCloseModal()

  /* The banner names the level earned last; opening it closes the story
     and lets the Atlas present the celebration without its usual wait. */
  const lastEarned = celebration.length ? celebration[celebration.length - 1] : null
  const newReward = lastEarned ? { name: rewards.levels.find((level) => level.id === lastEarned)?.name ?? lastEarned } : null
  const openReward = useCallback(() => {
    requestCelebration()
    close()
  }, [requestCelebration, close])

  const sealSettled = useCallback(() => haptic('medium'), [])

  const bottomPadding = insets.bottom + (ceremony ? STICKY_CLEARANCE + space.lg : space.xxl)

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        <StoryHero cottage={cottage} scrollY={scrollY} ceremony={ceremony} />
        <StoryBody
          cottage={cottage}
          ceremony={ceremony}
          foundAt={state.found[cottage.slug]?.foundAt ?? null}
          newReward={newReward}
          onOpenReward={openReward}
          onSealSettled={sealSettled}
        />
      </Animated.ScrollView>
      {ceremony ? (
        <View style={[styles.sticky, { paddingBottom: insets.bottom + space.lg }]}>
          <LinearGradient pointerEvents="none" colors={STICKY_GRADIENT} style={styles.stickyFade} />
          <Button variant="primary" block onPress={close}>
            {t('mobile:story.backToAtlas')}
          </Button>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.page,
  },
  stickyFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -STICKY_FADE_HEIGHT,
    height: STICKY_FADE_HEIGHT,
  },
})
