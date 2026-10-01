import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  ReduceMotion,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { contentUrl } from '../../lib/content'
import { ContentImage, CottageIcon, EASING, SPRINGS, Text, iconSize, mapPalette } from '../../ui'

/* The pieces that sit on the map, drawn after the site's map styles: the
   tilted teardrop pin with the house (green once found), the round cluster
   badge with a count and the seeker's dot. The drawing is the site's; what
   moves is the chosen pin (a small lift), a pin that has just been found
   (the clue face crossfades into the found one under an expanding ring)
   and the breathing ring around the seeker's dot. */

export const PIN_WIDTH = 52
export const PIN_HEIGHT = 58

/* A teardrop: round top, tip at the bottom centre. */
const TEARDROP = 'M26 3 C13.3 3 3 13.3 3 26 C3 38 15 46 26 55.5 C37 46 49 38 49 26 C49 13.3 38.7 3 26 3 Z'

/* The pin's head is the round top of the teardrop; the pulse ring grows
   out of its centre. */
const PULSE_SIZE = 40
const PULSE_TOP = 6
const PULSE_LEFT = (PIN_WIDTH - PULSE_SIZE) / 2
const PULSE_CYCLE_MS = 700
const PULSE_CYCLES = 2
const CROSSFADE_MS = 400

type PinPalette = 'clue' | 'found'

/* The teardrop and its content in one of the two palettes; exactly the
   site's pin, unchanged. */
function PinFace({ palette, active, customImage }: { palette: PinPalette; active: boolean; customImage?: string }) {
  const found = palette === 'found'
  const top = found ? mapPalette.pinFoundTop : mapPalette.pinTop
  const bottom = found ? mapPalette.pinFoundBottom : mapPalette.pinBottom
  const border = found ? mapPalette.pinFoundBorder : mapPalette.pinBorder
  const ink = found ? mapPalette.pinFoundInk : mapPalette.pinInk
  return (
    <View style={styles.face}>
      <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}>
        <Defs>
          <LinearGradient id="pin" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={active ? border : top} stopOpacity={active ? 0.55 : 1} />
            <Stop offset={active ? '0.35' : '0'} stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Path d={TEARDROP} fill="url(#pin)" stroke={border} strokeWidth={2} />
        <Path d={TEARDROP} fill="none" stroke={mapPalette.pinHalo} strokeWidth={5} />
      </Svg>
      <View style={styles.pinContent}>
        {customImage ? (
          <ContentImage uri={contentUrl(customImage)} policy="disk" contentFit="contain" style={styles.pinImage} />
        ) : (
          <CottageIcon size={iconSize.lg} weight="fill" color={ink} />
        )}
      </View>
    </View>
  )
}

type CottagePinProps = {
  found: boolean
  active: boolean
  /* The cottage was found moments ago: the clue face crossfades into the
     found one with a pulse. */
  justFound?: boolean
  customImage?: string
}

export function CottagePin({ found, active, justFound = false, customImage }: CottagePinProps) {
  const reduced = useReducedMotion()
  const lift = useSharedValue(active ? -4 : 0)
  const scale = useSharedValue(active ? 1.08 : 1)
  const foundOpacity = useSharedValue(found && !justFound ? 1 : 0)
  /* 0 at rest, 1 at the end of a pulse cycle (the ring is invisible there). */
  const pulse = useSharedValue(1)

  useEffect(() => {
    lift.value = withSpring(active ? -4 : 0, SPRINGS.gentle)
    scale.value = withSpring(active ? 1.08 : 1, SPRINGS.gentle)
    if (active && !reduced) {
      pulse.value = 0
      pulse.value = withRepeat(withTiming(1, { duration: PULSE_CYCLE_MS, easing: EASING.out }), PULSE_CYCLES, false)
    }
  }, [active, reduced, lift, scale, pulse])

  useEffect(() => {
    if (justFound) {
      foundOpacity.value = withTiming(1, { duration: CROSSFADE_MS, easing: EASING.inOut, reduceMotion: ReduceMotion.System })
      if (!reduced) {
        pulse.value = 0
        pulse.value = withRepeat(withTiming(1, { duration: PULSE_CYCLE_MS, easing: EASING.out }), PULSE_CYCLES, false)
      }
      return
    }
    foundOpacity.value = found ? 1 : 0
  }, [justFound, found, reduced, foundOpacity, pulse])

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }))
  const foundStyle = useAnimatedStyle(() => ({ opacity: foundOpacity.value }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.8, 2]) }],
  }))

  const ringColor = found || justFound ? mapPalette.pinFoundBorder : mapPalette.pinBorder
  return (
    <Animated.View style={[styles.pin, bodyStyle]}>
      <Animated.View pointerEvents="none" style={[styles.pulse, { borderColor: ringColor }, ringStyle]} />
      {found && !justFound ? (
        <PinFace palette="found" active={active} customImage={customImage} />
      ) : (
        <>
          <PinFace palette="clue" active={active} customImage={customImage} />
          {justFound ? (
            <Animated.View style={[StyleSheet.absoluteFill, foundStyle]}>
              <PinFace palette="found" active={active} customImage={customImage} />
            </Animated.View>
          ) : null}
        </>
      )}
    </Animated.View>
  )
}

export const CLUSTER_SIZE = 58

export function ClusterBadge({ count }: { count: number }) {
  return (
    <View style={styles.cluster}>
      <Svg width={CLUSTER_SIZE} height={CLUSTER_SIZE} viewBox={`0 0 ${CLUSTER_SIZE} ${CLUSTER_SIZE}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cluster" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={mapPalette.clusterTop} />
            <Stop offset="1" stopColor={mapPalette.clusterBottom} />
          </LinearGradient>
        </Defs>
        <Circle cx={29} cy={29} r={26} fill={mapPalette.clusterHalo} />
        <Circle cx={29} cy={29} r={22} fill="url(#cluster)" stroke={mapPalette.clusterBorder} strokeWidth={2} />
      </Svg>
      <View style={styles.clusterContent}>
        <CottageIcon size={iconSize.sm} weight="fill" color={mapPalette.clusterInk} />
        <Text weight="bold" variant="compact" style={styles.clusterCount}>
          {count}
        </Text>
      </View>
    </View>
  )
}

const BREATH_MS = 1400

/* The seeker's dot: zooms in on the first fix, then a ring keeps breathing
   out of it (static under reduced motion). */
export function UserDot() {
  const reduced = useReducedMotion()
  const breath = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    breath.value = 0
    breath.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: EASING.out }), -1, false)
    return () => cancelAnimation(breath)
  }, [reduced, breath])

  const breathStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(breath.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.6]) }],
  }))

  return (
    <Animated.View entering={ZoomIn.springify().reduceMotion(ReduceMotion.System)} style={styles.user}>
      <Animated.View pointerEvents="none" style={[styles.userBreath, breathStyle]} />
      <View style={styles.userRing}>
        <View style={styles.userDot} />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  face: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  pulse: {
    position: 'absolute',
    top: PULSE_TOP,
    left: PULSE_LEFT,
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: 2,
  },
  pinContent: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pinImage: {
    width: 30,
    height: 30,
    backgroundColor: 'transparent',
  },
  cluster: {
    width: CLUSTER_SIZE,
    height: CLUSTER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  clusterCount: {
    color: mapPalette.clusterInk,
  },
  user: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBreath: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: mapPalette.userRing,
  },
  userRing: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: mapPalette.userRing,
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: mapPalette.userDotBorder,
    backgroundColor: mapPalette.userDot,
  },
})
