import { useCallback, useEffect, useRef } from 'react'
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { RewardLevel } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { contentUrl } from '../../lib/content'
import { haptic } from '../../lib/haptics'
import { useContent, useProgress } from '../../providers'
import { Button, ContentImage, DURATIONS, GlowPulse, MarkdownView, ReduceMotion, RewardIcon, SPRINGS, Text, colors, fade, iconSize, radius, space, useReducedMotion } from '../../ui'

/* The celebration of a level earned by a live find: a card over the Atlas
   with the reward's art glowing, its name and first lines, presented once
   the story has closed. Several levels earned at once are turned page by
   page. Nothing but the two buttons (or the next card) dismisses it, so a
   reward is always acknowledged. */

const CARD_MAX_WIDTH = 420
const ART_MAX = 200
const GLOW_MARGIN = 48
const RISE = 40
const SHRINK = 0.1

/* Only the opening lines of the card's text fit the celebration. */
function firstBlock(markdown: string) {
  return markdown.trim().split(/\n\s*\n/)[0] ?? ''
}

export function RewardReveal() {
  const { t } = useTranslation()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const { celebration, shiftCelebration, clearCelebration } = useProgress()
  const { rewards } = useContent()

  /* Every way out passes this flag, so a double back can never happen. */
  const leaving = useRef(false)
  const leave = useCallback(
    (then?: () => void) => {
      if (leaving.current) return
      leaving.current = true
      clearCelebration()
      router.back()
      then?.()
    },
    [clearCelebration, router],
  )

  /* Presented with nothing to show (a stale push): gone at once. */
  const initialCount = useRef(celebration.length)
  useEffect(() => {
    if (initialCount.current === 0) leave()
  }, [leave])

  /* Android back is acknowledged, not obeyed, while this card is the top
     screen; a route pushed over it (a plaque link) gets its own back. */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true)
      return () => subscription.remove()
    }, []),
  )

  /* The queue emptied under the card (cleared from elsewhere): nothing to
     show, so the transparent modal leaves rather than blocking the map. */
  useEffect(() => {
    if (initialCount.current > 0 && celebration.length === 0) leave()
  }, [celebration.length, leave])

  /* 1 at rest below and smaller; 0 in place. */
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    rise.value = withSpring(0, SPRINGS.reveal, (finished) => {
      if (finished) scheduleOnRN(haptic, 'success')
    })
  }, [rise])
  const cardMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: rise.value * RISE }, { scale: 1 - rise.value * SHRINK }],
  }))

  const id = celebration[0]
  const level: RewardLevel | null = id ? (rewards.levels.find((candidate) => candidate.id === id) ?? { id, name: id, threshold: null, final: false, image: '', body: '' }) : null

  useEffect(() => {
    if (level) announce(t('mobile:celebrate.aria', { name: level.name }))
  }, [level?.id, level?.name, t])

  if (!level) return null

  const total = Math.max(initialCount.current, celebration.length)
  const index = total - celebration.length + 1
  const hasMore = celebration.length > 1
  const cardWidth = Math.min(CARD_MAX_WIDTH, width - 2 * space.xl)
  const art = Math.min(ART_MAX, cardWidth - 2 * space.xl)
  const intro = firstBlock(level.body)

  /* Navigating to the tab beneath brings the stack back to the tabs, which
     takes this card with it: one step, no back of its own. */
  const openKronika = () => {
    if (leaving.current) return
    leaving.current = true
    clearCelebration()
    router.navigate('/kronika')
  }

  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <Animated.View entering={fade(250)} style={styles.backdrop}>
        <Pressable accessible={false} style={styles.backdropTouch} />
      </Animated.View>
      <Animated.View style={[styles.card, { width: cardWidth }, cardMotion]}>
        <Animated.View key={level.id} entering={fade()} exiting={FadeOut.duration(DURATIONS.fast).reduceMotion(ReduceMotion.System)} style={styles.cardBody}>
          <Text variant="eyebrow" align="center">
            {t('mobile:celebrate.eyebrow')}
          </Text>
          <GlowPulse size={art + GLOW_MARGIN}>
            {level.image ? (
              <ContentImage uri={contentUrl(level.image)} aspectRatio={1} radius={radius.card} accessibilityLabel={level.name} style={{ width: art }} />
            ) : (
              <View style={[styles.artFallback, { width: art, height: art }]}>
                <RewardIcon size={iconSize.emblem} weight="fill" color={colors.accentStrong} />
              </View>
            )}
          </GlowPulse>
          <Text variant="title" align="center" accessibilityRole="header">
            {t('achievement.newReward', { name: level.name })}
          </Text>
          <Text variant="small" tone="accent" weight="semibold" align="center">
            {t('mobile:celebrate.earnedNow')}
          </Text>
          {intro ? <MarkdownView>{intro}</MarkdownView> : null}
          {hasMore ? (
            <View style={styles.actions}>
              <Text variant="small" tone="faint" align="center">
                {t('mobile:celebrate.counter', { index, count: total })}
              </Text>
              <Button variant="primary" block onPress={shiftCelebration}>
                {t('mobile:common.next')}
              </Button>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button variant="primary" block onPress={openKronika}>
                {t('quest.chronicleOpen')}
              </Button>
              <Button block onPress={() => leave()}>
                {t('ranking.continueTitle')}
              </Button>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backdrop,
  },
  backdropTouch: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: space.xl,
  },
  cardBody: {
    alignItems: 'center',
    gap: space.md,
  },
  artFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    backgroundColor: colors.pageRaised,
  },
  actions: {
    alignSelf: 'stretch',
    gap: space.sm,
    marginTop: space.sm,
  },
})
