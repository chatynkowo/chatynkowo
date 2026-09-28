import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { Text } from './Text'
import { colors, space } from './tokens'

/* The frame every screen renders inside: page background, safe areas, an
   optional header (eyebrow, title, lead, an action on the right) and either
   a scrolling body or a flex body for screens that scroll themselves (the
   map, the camera). */

export type ScreenFrameProps = {
  eyebrow?: string
  title?: string
  lead?: string
  /* A control rendered to the right of the title, e.g. an IconButton. */
  action?: ReactNode
  /* Wrap the body in a ScrollView (default) or let it fill the screen. */
  scroll?: boolean
  /* Horizontal padding around the body; off for edge-to-edge content. */
  padded?: boolean
  edges?: Edge[]
  contentStyle?: StyleProp<ViewStyle>
  children: ReactNode
}

export function ScreenFrame({
  eyebrow,
  title,
  lead,
  action,
  scroll = true,
  padded = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
  children,
}: ScreenFrameProps) {
  const header = (eyebrow || title || lead) && (
    <View style={[styles.header, !padded && styles.padded]}>
      <View style={styles.headerText}>
        {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
        {title ? (
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {lead ? (
          <Text tone="soft">
            {lead}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.page} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, padded && styles.padded, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padded && styles.padded, contentStyle]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.page,
  },
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
    paddingTop: space.lg,
    gap: space.lg,
  },
  padded: {
    paddingHorizontal: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  headerText: {
    flex: 1,
    gap: space.xs,
  },
  action: {
    paddingTop: space.xs,
  },
})
