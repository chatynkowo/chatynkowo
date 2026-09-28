import { Image, StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { contentUrl } from '../../lib/content'
import { CottageIcon, Text, iconSize, mapPalette } from '../../ui'

/* The pieces that sit on the map, drawn after the site's map styles: the
   tilted teardrop pin with the house (green once found), the round cluster
   badge with a count and the seeker's dot. */

export const PIN_WIDTH = 52
export const PIN_HEIGHT = 58

/* A teardrop: round top, tip at the bottom centre. */
const TEARDROP = 'M26 3 C13.3 3 3 13.3 3 26 C3 38 15 46 26 55.5 C37 46 49 38 49 26 C49 13.3 38.7 3 26 3 Z'

type CottagePinProps = {
  found: boolean
  active: boolean
  customImage?: string
}

export function CottagePin({ found, active, customImage }: CottagePinProps) {
  const top = found ? mapPalette.pinFoundTop : mapPalette.pinTop
  const bottom = found ? mapPalette.pinFoundBottom : mapPalette.pinBottom
  const border = found ? mapPalette.pinFoundBorder : mapPalette.pinBorder
  const ink = found ? mapPalette.pinFoundInk : mapPalette.pinInk
  return (
    <View style={[styles.pin, active && styles.pinActive]}>
      <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}>
        <Defs>
          <LinearGradient id="pin" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={active ? border : top} stopOpacity={active ? 0.55 : 1} />
            <Stop offset={active ? '0.35' : '0'} stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Path d={TEARDROP} fill="url(#pin)" stroke={border} strokeWidth={2} />
        <Path d={TEARDROP} fill="none" stroke="rgba(247, 211, 129, 0.14)" strokeWidth={5} />
      </Svg>
      <View style={styles.pinContent}>
        {customImage ? (
          <Image source={{ uri: contentUrl(customImage) }} style={styles.pinImage} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <CottageIcon size={iconSize.lg} weight="fill" color={ink} />
        )}
      </View>
    </View>
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
        <Text weight="bold" style={styles.clusterCount}>
          {count}
        </Text>
      </View>
    </View>
  )
}

export function UserDot() {
  return (
    <View style={styles.userRing}>
      <View style={styles.userDot} />
    </View>
  )
}

const styles = StyleSheet.create({
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  pinActive: {
    transform: [{ translateY: -4 }, { scale: 1.08 }],
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
    fontSize: 16,
    lineHeight: 20,
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
