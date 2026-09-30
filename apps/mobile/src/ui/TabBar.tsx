import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Platform, StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CommonActions } from 'expo-router/react-navigation'
import type { BottomTabBarProps, BottomTabNavigationOptions } from 'expo-router/js-tabs'
import { KeyIcon, iconSize } from './icons'
import { PressableScale } from './PressableScale'
import { Text } from './Text'
import { colors, radius, sizes, space } from './tokens'

/* The app's own tab bar and the height it covers. The bar floats over the
   tab screens (so the map runs under it) with the raised gold "discover"
   button in its middle slot; the tabs around it draw the glyph, the label
   and the badge their route options carry. Every screen that puts
   something at its bottom edge (the Atlas chrome, a list's last row) reads
   `useTabBarHeight()` instead of guessing: the bar's full height including
   the home indicator area, 0 where no bar is mounted. The bar reports its
   measured layout through `useTabBarHeightSetter()`. */

/* ---------- The height ---------- */

type TabBarHeightValue = { height: number; setHeight: (height: number) => void }

const TabBarHeightContext = createContext<TabBarHeightValue | null>(null)

export function TabBarHeightProvider({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(0)
  const value = useMemo(() => ({ height, setHeight }), [height])
  return <TabBarHeightContext.Provider value={value}>{children}</TabBarHeightContext.Provider>
}

export function useTabBarHeight(): number {
  return useContext(TabBarHeightContext)?.height ?? 0
}

export function useTabBarHeightSetter(): (height: number) => void {
  const value = useContext(TabBarHeightContext)
  return value ? value.setHeight : () => undefined
}

/* What a scroll view with automatic content insets adds at its bottom to
   end above the bar: iOS already supplies the home indicator inset through
   that adjustment, so only the bar above it is added; Android adds the
   whole bar. Also the scroll indicator's bottom inset. */
export function useTabBarClearance(): number {
  const height = useTabBarHeight()
  const insets = useSafeAreaInsets()
  return Platform.OS === 'ios' ? Math.max(0, height - insets.bottom) : height
}

/* ---------- The bar ---------- */

/* The centre button rises by half its size, so its centre sits on the
   bar's top edge. Content that ends right above the bar (the cottage
   sheet's last lines) keeps this much clear of the button. */
const DISCOVER_SIZE = 60
export const TAB_BAR_OVERHANG = DISCOVER_SIZE / 2
const LONG_PRESS_MS = 400
/* The labels of the tabs and of the centre button share one baseline. */
const LABEL_INSET = 10

export type DiscoverAction = {
  label: string
  accessibilityLabel: string
  /* The accessibility action standing in for the long press. */
  scanLabel: string
  onPress: () => void
  onLongPress: () => void
}

export type TabBarProps = BottomTabBarProps & {
  /* The raised centre button between the tabs. */
  discover: DiscoverAction
}

export function TabBar({ state, descriptors, navigation, insets, discover }: TabBarProps) {
  const setHeight = useTabBarHeightSetter()
  const onLayout = (event: LayoutChangeEvent) => setHeight(Math.round(event.nativeEvent.layout.height))

  /* The same press contract as the navigator's own bar: a tab press the
     layout may listen to (and prevent), then the switch; a long press is
     only announced. */
  const tabs = state.routes.map((route, index) => {
    const focused = index === state.index
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
      if (!focused && !event.defaultPrevented) navigation.dispatch({ ...CommonActions.navigate(route), target: state.key })
    }
    const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key })
    return <TabItem key={route.key} name={route.name} options={descriptors[route.key].options} focused={focused} onPress={onPress} onLongPress={onLongPress} />
  })
  const middle = Math.ceil(tabs.length / 2)

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={[styles.bar, { height: sizes.tabBar + insets.bottom, paddingBottom: insets.bottom }]} onLayout={onLayout} accessibilityRole="tablist">
        {tabs.slice(0, middle)}
        <DiscoverSlot {...discover} />
        {tabs.slice(middle)}
      </View>
    </View>
  )
}

type TabItemProps = {
  name: string
  options: BottomTabNavigationOptions
  focused: boolean
  onPress: () => void
  onLongPress: () => void
}

/* One tab: the glyph (filled when selected) with its badge, the label
   under it. The press feedback is the scale alone; the tab press haptic is
   the layout's listener. */
function TabItem({ name, options, focused, onPress, onLongPress }: TabItemProps) {
  const color = focused ? colors.accentStrong : colors.inkFaint
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={options.tabBarAccessibilityLabel}
      accessibilityState={{ selected: focused }}
      testID={options.tabBarButtonTestID}
      onPress={onPress}
      onLongPress={onLongPress}
      pressedFill="transparent"
      style={styles.tab}
    >
      <View style={styles.glyph}>
        {options.tabBarIcon?.({ focused, color, size: iconSize.lg })}
        {options.tabBarBadge !== undefined ? <Badge value={options.tabBarBadge} /> : null}
      </View>
      <TabLabel color={color}>{options.title ?? name}</TabLabel>
    </PressableScale>
  )
}

/* The count at the glyph's top right: seals not yet viewed on the Kronika. */
function Badge({ value }: { value: number | string }) {
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text tone="accentInk" weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.badgeText}>
        {String(value)}
      </Text>
    </View>
  )
}

/* The gold button in the middle slot: a press opens the code sheet, a long
   press (or the "scan" accessibility action) the scanner. The haptics
   belong to the actions, so the pressable fires none itself; the label is
   decoration next to the button's own accessible name. */
function DiscoverSlot({ label, accessibilityLabel, scanLabel, onPress, onLongPress }: DiscoverAction) {
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'scan') onLongPress()
  }
  return (
    <View style={styles.discoverSlot}>
      <PressableScale
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={[{ name: 'scan', label: scanLabel }]}
        onAccessibilityAction={onAccessibilityAction}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={LONG_PRESS_MS}
        /* The accent wash is invisible on the gold face; the lighter border
           gold reads as a pressed shade there, on both platforms. */
        pressedFill={colors.accentBorder}
        ripple={false}
        scaleTo={0.94}
        style={styles.discover}
      >
        <KeyIcon size={iconSize.lg} weight="fill" color={colors.accentInk} />
      </PressableScale>
      <TabLabel color={colors.inkFaint} decorative>
        {label}
      </TabLabel>
    </View>
  )
}

/* The bar's label size: smaller than the small role, since the bar's
   height is fixed and the label sits under a glyph. */
function TabLabel({ color, decorative, children }: { color: string; decorative?: boolean; children: string }) {
  return (
    <Text
      variant="small"
      weight="semibold"
      numberOfLines={1}
      maxFontSizeMultiplier={1.3}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[styles.label, { color }]}
    >
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  /* The raised button pokes above the bar; the root keeps that strip
     inside its own bounds, transparent and letting touches through. */
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: TAB_BAR_OVERHANG,
  },
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.pageRaised,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.xs,
    paddingBottom: LABEL_INSET,
  },
  glyph: {
    width: iconSize.lg,
    height: iconSize.lg,
  },
  badge: {
    position: 'absolute',
    top: -space.xs,
    left: iconSize.lg - space.sm,
    minWidth: 16,
    height: 16,
    paddingHorizontal: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
  },
  /* The column overflows the bar upward by the raise, which puts the
     button's centre on the top edge and its label on the tabs' baseline. */
  discoverSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: LABEL_INSET,
    paddingBottom: LABEL_INSET,
  },
  discover: {
    width: DISCOVER_SIZE,
    height: DISCOVER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    shadowColor: colors.page,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
})
