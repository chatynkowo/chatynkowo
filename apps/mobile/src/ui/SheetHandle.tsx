import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius, space } from './tokens'

/* The grabber of a form sheet route (code, reward, rules). iOS
   draws the system one (`sheetGrabberVisible`); Android's form sheet has
   none, so the same mark is drawn here and nothing renders elsewhere. */
export function SheetHandle({ style }: { style?: StyleProp<ViewStyle> }) {
  if (Platform.OS !== 'android') return null
  return <View style={[styles.handle, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
}

const styles = StyleSheet.create({
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginBottom: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.lineStrong,
  },
})
