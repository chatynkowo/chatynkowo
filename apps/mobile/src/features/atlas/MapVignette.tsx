import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { mapPalette, radius, space } from '../../ui'

/* The frame the site draws over its map, now on a full-bleed map: darkened
   edges, a green glow that fades as the map turns real and a thin gold line
   inside the safe area. The glow follows the map's `reality` shared value
   straight from the map's region events, so panning never renders React.
   Both gradients are static pictures; only the glow's container fades, an
   opacity the compositor applies, so nothing is re-rasterised while the map
   moves (an animated SVG prop redraws the whole full-screen gradient on
   every change, which a phone feels as a stutter). */

const GLOW_PEAK = 0.32

type MapVignetteProps = {
  /* 0 at the parchment zooms, 1 once the tiles show the real land. */
  reality: SharedValue<number>
  topInset: number
  bottomInset: number
}

export function MapVignette({ reality, topInset, bottomInset }: MapVignetteProps) {
  const { width, height } = useWindowDimensions()
  const glowStyle = useAnimatedStyle(() => ({ opacity: 1 - reality.value }))
  const viewBox = `0 0 ${width} ${height}`
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="glow" cx="20%" cy="28%" r="26%">
              <Stop offset="0" stopColor={mapPalette.glow} stopOpacity={GLOW_PEAK} />
              <Stop offset="1" stopColor={mapPalette.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="shade" cx="50%" cy="46%" r="72%">
            <Stop offset="0.5" stopColor={mapPalette.vignette} stopOpacity={0} />
            <Stop offset="1" stopColor={mapPalette.vignette} stopOpacity={0.5} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#shade)" />
      </Svg>
      <View style={[styles.line, { top: topInset + space.sm, bottom: bottomInset + space.sm }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    right: space.sm,
    left: space.sm,
    borderWidth: 1,
    borderColor: mapPalette.vignetteLine,
    borderRadius: radius.card - 10,
  },
})
