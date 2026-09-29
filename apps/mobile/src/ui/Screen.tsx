import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, space } from './tokens'

/* The body of a screen under a native header: a scrolling column with the
   page padding and the shared gap, or a flex view for screens that scroll
   themselves. No safe-area handling and no drawn header: the native stack
   owns both, and the content inset adjusts under a transparent bar. Screens
   with no header at all (welcome) ask for the top inset explicitly. */

export type ScreenProps = {
  mode?: 'scroll' | 'fill'
  /* Horizontal page padding; off for edge-to-edge content. */
  padded?: boolean
  refreshing?: boolean
  /* Mounts a RefreshControl in the accent colour. */
  onRefresh?: () => void | Promise<void>
  /* keyboardDismissMode of the scroll view. */
  keyboard?: 'none' | 'interactive'
  /* Adds the top safe-area inset; for routes without a native header. */
  topInset?: boolean
  contentStyle?: StyleProp<ViewStyle>
  children: ReactNode
}

export function Screen({ mode = 'scroll', padded = true, refreshing, onRefresh, keyboard = 'none', topInset = false, contentStyle, children }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)

  /* Callers may return a promise; the spinner then follows it when they do
     not drive `refreshing` themselves. */
  const refresh = useCallback(async () => {
    if (!onRefresh) return
    setBusy(true)
    try {
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }, [onRefresh])

  const inset = topInset ? { paddingTop: insets.top + space.lg } : null

  if (mode === 'fill') {
    return <View style={[styles.fill, padded && styles.padded, inset, contentStyle]}>{children}</View>
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, padded && styles.padded, inset, contentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      scrollIndicatorInsets={{ right: 1 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={keyboard === 'interactive' ? 'interactive' : 'none'}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? busy}
            onRefresh={() => void refresh()}
            tintColor={colors.accentStrong}
            colors={[colors.accentStrong]}
            progressBackgroundColor={colors.pageRaised}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  fill: {
    flex: 1,
    gap: space.lg,
  },
  padded: {
    paddingHorizontal: space.lg,
  },
})
