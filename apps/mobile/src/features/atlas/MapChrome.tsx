import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { CrossfadeText, DURATIONS, KeyIcon, PressableScale, SearchIcon, Text, colors, iconSize, mapPalette, radius, space, type Icon } from '../../ui'

/* The dark cards the site lays over its map, floating on the full-bleed
   Atlas: the level indicator, the control bars, the tip, the offline and
   stale pills and the gold "I have a code" pill. Icons and copy take the
   map's gold and cream; every control is a PressableScale so the press feel
   matches the rest of the app. The screen wires the labels and actions. */

export function LevelCard({ label, level }: { label: string; level: string }) {
  return (
    <View style={[styles.card, styles.level]} accessibilityLiveRegion="polite">
      <Text style={styles.levelLabel}>{label}</Text>
      <CrossfadeText value={level} weight="bold" style={styles.levelValue} />
    </View>
  )
}

export type MapControl = {
  key: string
  label: string
  icon: ReactNode
  onPress: () => void
  disabled?: boolean
  /* The control is working (locating): its icon pulses. */
  busy?: boolean
}

const BUSY_PULSE_MS = 400

/* The icon of a control, pulsing while its control is busy; a steady 0.6
   under reduced motion. */
function ControlIcon({ busy, children }: { busy: boolean; children: ReactNode }) {
  const reduced = useReducedMotion()
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (!busy) {
      opacity.value = withTiming(1, { duration: DURATIONS.fast })
      return
    }
    if (reduced) {
      opacity.value = 0.6
      return
    }
    opacity.value = withRepeat(withSequence(withTiming(0.4, { duration: BUSY_PULSE_MS }), withTiming(1, { duration: BUSY_PULSE_MS })), -1, false)
    return () => cancelAnimation(opacity)
  }, [busy, reduced, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={style}>{children}</Animated.View>
}

export function ControlBar({ controls }: { controls: MapControl[] }) {
  return (
    <View style={[styles.card, styles.bar]}>
      {controls.map((control, index) => (
        <PressableScale
          key={control.key}
          accessibilityLabel={control.label}
          accessibilityState={{ disabled: Boolean(control.disabled), busy: Boolean(control.busy) }}
          disabled={control.disabled}
          onPress={control.onPress}
          haptic="select"
          scaleTo={0.94}
          style={[styles.control, index > 0 && styles.controlDivider, control.disabled && !control.busy && styles.controlDisabled]}
        >
          <ControlIcon busy={Boolean(control.busy)}>{control.icon}</ControlIcon>
        </PressableScale>
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

/* A small status pill under the top row: offline, or a saved copy that is
   being refreshed (tap to refresh now). */
export function StatusPill({ icon: Glyph, label, onPress }: { icon: Icon; label: string; onPress?: () => void }) {
  const content = (
    <>
      <Glyph size={iconSize.sm} color={mapPalette.chromeIcon} />
      <Text variant="small" style={styles.pillText}>
        {label}
      </Text>
    </>
  )
  if (!onPress) {
    return (
      <View style={[styles.card, styles.pill]} accessibilityLiveRegion="polite">
        {content}
      </View>
    )
  }
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} haptic="select" style={[styles.card, styles.pill]}>
      {content}
    </PressableScale>
  )
}

type HaveCodeFabProps = {
  label: string
  accessibilityLabel: string
  /* The accessibility action standing in for the long press. */
  scanLabel: string
  onPress: () => void
  onLongPress: () => void
}

const LONG_PRESS_MS = 400

/* The one unlock action in thumb reach: a press opens the code sheet, a
   long press (or the "scan" accessibility action) opens the scanner. The
   haptics belong to the actions, so the pressable fires none itself. */
export function HaveCodeFab({ label, accessibilityLabel, scanLabel, onPress, onLongPress }: HaveCodeFabProps) {
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'scan') onLongPress()
  }
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={[{ name: 'scan', label: scanLabel }]}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={styles.fab}
    >
      <KeyIcon size={iconSize.md} weight="fill" color={colors.accentInk} />
      <Text weight="bold" tone="accentInk" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
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
    fontSize: 11,
    lineHeight: 14,
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: space.xs,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  pillText: {
    color: mapPalette.chromeInk,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    minWidth: 168,
    paddingHorizontal: space.xl,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
})
