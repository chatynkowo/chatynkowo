import { StyleSheet } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import { DURATIONS, ReduceMotion, fade, layoutLinear } from './motion'
import { Text, type TextProps } from './Text'

/* Text whose value changes in place: the level card, "your place", the
   pending count, the download state. Each value is its own line keyed by
   its content, so a change fades the old one out while the new one fades
   in and the neighbours slide to the new width. */

const FADE_OUT_MS = 120

export function CrossfadeText({ value, ...rest }: TextProps & { value: string }) {
  return (
    <Animated.View key={value} entering={fade(DURATIONS.fast)} exiting={FadeOut.duration(FADE_OUT_MS).reduceMotion(ReduceMotion.System)} layout={layoutLinear} style={styles.line}>
      <Text {...rest}>{value}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  line: {
    flexShrink: 1,
  },
})
