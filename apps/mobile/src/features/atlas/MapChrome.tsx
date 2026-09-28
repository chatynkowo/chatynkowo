import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { SearchIcon, Text, iconSize, mapPalette, radius, space } from '../../ui'

/* The dark cards the site lays over its map: the level indicator, the
   control bar and the tip. Icons and copy take the map's gold and cream. */

export function LevelCard({ label, level }: { label: string; level: string }) {
  return (
    <View style={[styles.card, styles.level]} accessibilityLiveRegion="polite">
      <Text style={styles.levelLabel}>{label}</Text>
      <Text weight="bold" style={styles.levelValue}>
        {level}
      </Text>
    </View>
  )
}

export type MapControl = { key: string; label: string; icon: ReactNode; onPress: () => void; disabled?: boolean }

export function ControlBar({ controls }: { controls: MapControl[] }) {
  return (
    <View style={[styles.card, styles.bar]}>
      {controls.map((control, index) => (
        <Pressable
          key={control.key}
          accessibilityRole="button"
          accessibilityLabel={control.label}
          accessibilityState={{ disabled: Boolean(control.disabled) }}
          disabled={control.disabled}
          onPress={control.onPress}
          style={({ pressed }) => [styles.control, index > 0 && styles.controlDivider, pressed && styles.controlPressed, control.disabled && styles.controlDisabled]}
        >
          {control.icon}
        </Pressable>
      ))}
    </View>
  )
}

export function MapTip({ children }: { children: string }) {
  return (
    <View style={[styles.card, styles.tip]}>
      <SearchIcon size={iconSize.sm} color={mapPalette.chromeIcon} />
      <Text variant="small" style={styles.tipText}>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.control,
    backgroundColor: mapPalette.chrome,
  },
  level: {
    minWidth: 104,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  levelLabel: {
    color: mapPalette.chromeInk,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  levelValue: {
    color: mapPalette.chromeInk,
    fontSize: 15,
    lineHeight: 20,
  },
  bar: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  control: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDivider: {
    borderLeftWidth: 1,
    borderLeftColor: mapPalette.chromeDivider,
  },
  controlPressed: {
    backgroundColor: 'rgba(225, 184, 99, 0.12)',
  },
  controlDisabled: {
    opacity: 0.38,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tipText: {
    color: mapPalette.chromeInk,
    flexShrink: 1,
  },
})
