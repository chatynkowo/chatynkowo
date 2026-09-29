import { StyleSheet, View } from 'react-native'
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated'
import { colors, mapPalette, space } from './tokens'

/* Page indicator for horizontal pagers (onboarding, the story hero). Reads
   the pager's scroll offset as a shared value so it never re-renders the
   pager: the dot under the current page stretches to 20 pt and takes the
   accent as the pages slide, its neighbours shrink back to 8 pt. Reduced
   motion keeps every dot round and only swaps the colour. */

export type PageDotsProps = {
  count: number
  scrollX: SharedValue<number>
  pageWidth: number
  /* Dots on the dark page (ink) or over a photo/parchment. */
  tone?: 'ink' | 'parchment'
}

const DOT = 8
const ACTIVE_WIDTH = 20

export function PageDots({ count, scrollX, pageWidth, tone = 'ink' }: PageDotsProps) {
  const reduceMotion = useReducedMotion()
  const inactive = tone === 'parchment' ? mapPalette.panelCloseBorder : colors.line
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => (
        <Dot key={index} index={index} scrollX={scrollX} pageWidth={pageWidth} inactive={inactive} reduceMotion={reduceMotion} />
      ))}
    </View>
  )
}

function Dot({ index, scrollX, pageWidth, inactive, reduceMotion }: { index: number; scrollX: SharedValue<number>; pageWidth: number; inactive: string; reduceMotion: boolean }) {
  const style = useAnimatedStyle(() => {
    const page = pageWidth > 0 ? scrollX.value / pageWidth : 0
    if (reduceMotion) {
      return { width: DOT, backgroundColor: Math.round(page) === index ? colors.accentStrong : inactive }
    }
    /* Distance from this dot's page, clamped to one page either side. */
    const distance = Math.min(1, Math.abs(page - index))
    return {
      width: interpolate(distance, [0, 1], [ACTIVE_WIDTH, DOT], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(distance, [0, 1], [colors.accentStrong, inactive]),
    }
  }, [pageWidth, index, inactive, reduceMotion])

  return <Animated.View style={[styles.dot, style]} />
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
})
