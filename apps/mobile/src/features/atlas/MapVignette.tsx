import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { mapPalette, radius } from '../../ui'

/* The frame the site draws over its map: darkened edges, a green glow that
   fades as the map turns real, a dark border and a thin gold line inside. */
export function MapVignette({ reality }: { reality: number }) {
  const { width } = useWindowDimensions()
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${width * 1.6}`} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="shade" cx="50%" cy="46%" r="72%">
            <Stop offset="0.5" stopColor={mapPalette.vignette} stopOpacity={0} />
            <Stop offset="1" stopColor={mapPalette.vignette} stopOpacity={0.5} />
          </RadialGradient>
          <RadialGradient id="glow" cx="20%" cy="28%" r="26%">
            <Stop offset="0" stopColor={mapPalette.glow} stopOpacity={0.32 * (1 - reality)} />
            <Stop offset="1" stopColor={mapPalette.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={width * 1.6} fill="url(#glow)" />
        <Rect x={0} y={0} width={width} height={width * 1.6} fill="url(#shade)" />
      </Svg>
      <View style={styles.border} />
      <View style={styles.line} />
    </View>
  )
}

const styles = StyleSheet.create({
  border: {
    ...StyleSheet.absoluteFill,
    borderWidth: 6,
    borderColor: mapPalette.vignetteBorder,
    borderRadius: radius.card,
  },
  line: {
    position: 'absolute',
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderWidth: 1,
    borderColor: mapPalette.vignetteLine,
    borderRadius: radius.card - 10,
  },
})
