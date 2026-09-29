import { useCallback, useEffect, useRef } from 'react'
import { Platform, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native'
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { content } from '../../lib/content'
import { ContentImage, DURATIONS, EASING, PageDots, ReduceMotion, colors, space, useReducedMotion } from '../../ui'

/* The cottage's photos, full-bleed at the top of the story: a paged strip
   whose pictures drift a quarter slower than the pages, fading into the page
   colour along the bottom edge so the seal can sit on it. Pulling the story
   down stretches the hero; a fresh unlock opens on it settling from a
   slight zoom. */

export const HERO_ASPECT = 4 / 3
const GRADIENT_HEIGHT = 96
const PARALLAX = 0.25
/* How far past the top the stretch keeps growing, and how much. */
const OVERSCROLL = 120
const OVERSCROLL_SCALE = 1.25
const CEREMONY_SCALE = 1.06
/* The picture is wider than its page so the parallax never shows an edge. */
const BLEED = PARALLAX * 2

type StoryHeroProps = {
  cottage: Cottage
  /* The story's vertical scroll offset. */
  scrollY: SharedValue<number>
  ceremony: boolean
  /* Space above the pictures on platforms whose bar is opaque. */
  topInset?: number
}

/* A colour with the alpha replaced: the gradient starts as the page colour
   made transparent, not as black. */
function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const GRADIENT = [withAlpha(colors.page, 0), colors.page] as const

export function StoryHero({ cottage, scrollY, ceremony, topInset = 0 }: StoryHeroProps) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const height = Math.round(width / HERO_ASPECT)
  const photos = content.storyPhotos(cottage)
  const scrollX = useSharedValue(0)
  const zoom = useSharedValue(ceremony && !reduceMotion ? CEREMONY_SCALE : 1)

  useEffect(() => {
    zoom.value = withTiming(1, { duration: DURATIONS.reveal, easing: EASING.out, reduceMotion: ReduceMotion.System })
  }, [zoom])

  const onPage = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x
  })

  /* Pulled past the top, the hero pins to the edge and grows. */
  const stretch = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ scale: 1 }] }
    const overscroll = Math.min(0, scrollY.value)
    const scale = interpolate(overscroll, [-OVERSCROLL, 0], [OVERSCROLL_SCALE, 1], Extrapolation.CLAMP) * zoom.value
    return { transform: [{ translateY: overscroll }, { scale }] }
  })

  /* Which photo is in view, for assistive tech; the first one is what the
     story opens on and is not called out. */
  const announced = useRef(0)
  const latest = useRef({ t, total: photos.length })
  latest.current = { t, total: photos.length }
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const index = viewableItems[0]?.index
    if (index == null || index === announced.current) return
    announced.current = index
    announce(latest.current.t('mobile:story.photoOf', { index: index + 1, total: latest.current.total }))
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  const renderPage = useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => (
      <HeroPage uri={item} index={index} width={width} height={height} scrollX={scrollX} parallax={!reduceMotion} label={t('story.photoAlt', { title: cottage.title })} />
    ),
    [width, height, scrollX, reduceMotion, t, cottage.title],
  )

  return (
    <Animated.View style={[styles.hero, { paddingTop: topInset, transformOrigin: 'top' }, stretch]}>
      <Animated.FlatList
        data={photos}
        keyExtractor={(uri) => uri}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={photos.length > 1}
        scrollEventThrottle={16}
        onScroll={onPage}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        initialNumToRender={1}
        windowSize={3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={{ height }}
        accessibilityRole="list"
      />
      <LinearGradient pointerEvents="none" colors={GRADIENT} style={styles.gradient} />
      {photos.length > 1 ? (
        <View pointerEvents="none" style={styles.dots}>
          <PageDots count={photos.length} scrollX={scrollX} pageWidth={width} />
        </View>
      ) : null}
    </Animated.View>
  )
}

function HeroPage({ uri, index, width, height, scrollX, parallax, label }: { uri: string; index: number; width: number; height: number; scrollX: SharedValue<number>; parallax: boolean; label: string }) {
  const drift = useAnimatedStyle(() => {
    if (!parallax) return { transform: [{ translateX: 0 }] }
    return { transform: [{ translateX: (scrollX.value - index * width) * PARALLAX }] }
  })
  const bleed = parallax ? width * BLEED : 0
  return (
    <View style={{ width, height, overflow: 'hidden' }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Animated.View style={[styles.page, { width: width + bleed, left: -bleed / 2 }, drift]}>
        <ContentImage uri={uri} style={styles.photo} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
  },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: GRADIENT_HEIGHT,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.md,
    alignItems: 'center',
  },
})

/* The pictures reach under the transparent bar on iOS; Android's bar is
   opaque, so the strip starts beneath it. */
export const HERO_UNDER_BAR = Platform.OS === 'ios'
