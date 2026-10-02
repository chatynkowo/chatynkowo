import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { BearingIcon, CrossfadeText, DURATIONS, PressableScale, SearchIcon, Text, fade, iconSize, layoutLinear, leave, mapPalette, radius, space, type Icon } from '../../ui'
import type { OutOfSight } from './AtlasMap'

/* The dark cards the site lays over its map, floating on the full-bleed
   Atlas: the level indicator, the control bars, the tip, the offline and
   stale pills and the beacon to the nearest cottage. Icons and copy take
   the map's gold and cream; every control is a PressableScale so the press
   feel matches the rest of the app. The screen wires the labels and
   actions. */

export function LevelCard({ label, level }: { label: string; level: string }) {
  return (
    <View style={[styles.card, styles.level]} accessibilityLiveRegion="polite">
      <Text variant="caption" style={styles.chromeInk}>
        {label}
      </Text>
      <CrossfadeText value={level} variant="compact" weight="bold" style={styles.chromeInk} />
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
    <PressableScale accessibilityLabel={label} onPress={onPress} style={[styles.card, styles.pill]}>
      {content}
    </PressableScale>
  )
}

type Size = { width: number; height: number }

/* The pill's size before it has been measured, close enough that the
   first placement barely moves. */
const BEACON_GUESS: Size = { width: 88, height: 32 }
/* Brings the pill's touch target to the size of a control; on the wrapper
   too, since a touch must enter it before the pressable can claim it. */
const BEACON_SLOP = { top: 7, bottom: 7, left: 7, right: 7 }

/* Where the line from the middle of the view towards `heading` (degrees
   clockwise from north, the top of the screen) leaves the box the pill may
   sit in: the map area inset by the chrome above and below and a margin at
   the sides, shrunk by half the pill so the whole pill stays inside. */
function edgePoint(heading: number, area: Size, pill: Size, exclude: { top: number; bottom: number }) {
  const radians = (heading * Math.PI) / 180
  const dx = Math.sin(radians)
  const dy = -Math.cos(radians)
  const left = space.lg + pill.width / 2
  const right = area.width - space.lg - pill.width / 2
  const top = exclude.top + space.md + pill.height / 2
  const bottom = area.height - exclude.bottom - space.md - pill.height / 2
  const cx = area.width / 2
  const cy = area.height / 2
  let reach = Infinity
  if (dx > 0) reach = Math.min(reach, (right - cx) / dx)
  else if (dx < 0) reach = Math.min(reach, (left - cx) / dx)
  if (dy > 0) reach = Math.min(reach, (bottom - cy) / dy)
  else if (dy < 0) reach = Math.min(reach, (top - cy) / dy)
  const x = Math.min(Math.max(cx + dx * reach, left), right)
  const y = Math.min(Math.max(cy + dy * reach, top), bottom)
  return { left: x - pill.width / 2, top: y - pill.height / 2 }
}

/* A distance for the beacon and its announcement: metres below a
   kilometre, one decimal below ten, whole kilometres beyond. */
export function formatDistance(km: number, locale: string, t: (key: string, values: Record<string, string>) => string): string {
  const metres = Math.round((km * 1000) / 50) * 50
  if (metres < 1000) return t('mobile:atlas.distanceM', { value: metres.toLocaleString(locale) })
  return t('mobile:atlas.distanceKm', { value: km.toLocaleString(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }) })
}

type NearestBeaconProps = {
  target: OutOfSight
  /* The chrome at the top and the bottom edge of the map the pill keeps
     clear of, in points. */
  exclude: { top: number; bottom: number }
  onPress: () => void
}

/* When no cottage is in view: a pill at the edge of the map pointing to
   the nearest one, with the distance. It sits where the line from the
   middle of the view to the cottage leaves the map and glides along the
   edge as the view moves; another cottage becoming the nearest fades a new
   pill in. A press flies there. Fills the map area, letting touches
   through everywhere but the pill. */
export function NearestBeacon({ target, exclude, onPress }: NearestBeaconProps) {
  const { t, i18n } = useTranslation()
  const [area, setArea] = useState<Size | null>(null)
  const [pill, setPill] = useState<Size>(BEACON_GUESS)

  const onAreaLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setArea((current) => (current && current.width === width && current.height === height ? current : { width, height }))
  }
  const onPillLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setPill((current) => (current.width === width && current.height === height ? current : { width, height }))
  }

  const distance = formatDistance(target.distanceKm, i18n.resolvedLanguage ?? i18n.language, t)

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onAreaLayout}>
      {area ? (
        <Animated.View
          key={target.cottage.slug}
          entering={fade()}
          exiting={leave()}
          layout={layoutLinear}
          style={[styles.beacon, edgePoint(target.heading, area, pill, exclude)]}
          onLayout={onPillLayout}
          hitSlop={BEACON_SLOP}
        >
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('mobile:atlas.nearestAria', { title: target.cottage.title, distance })}
            accessibilityHint={t('mobile:atlas.nearestHint')}
            hitSlop={BEACON_SLOP}
            onPress={onPress}
            style={[styles.card, styles.pill, styles.beaconPill]}
          >
            <View style={{ transform: [{ rotate: `${target.heading}deg` }] }}>
              <BearingIcon size={iconSize.sm} weight="bold" color={mapPalette.chromeIcon} />
            </View>
            <Text variant="small" weight="bold" style={styles.pillText}>
              {distance}
            </Text>
          </PressableScale>
        </Animated.View>
      ) : null}
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
  chromeInk: {
    color: mapPalette.chromeInk,
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
  beacon: {
    position: 'absolute',
  },
  beaconPill: {
    alignSelf: 'auto',
    gap: space.sm,
  },
})
