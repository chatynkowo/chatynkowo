import type { ReactNode } from 'react'
import { Children, Fragment, isValidElement } from 'react'
import { StyleSheet, View } from 'react-native'
import { CheckIcon, ForwardIcon, NextIcon } from './icons'
import { PressableScale } from './PressableScale'
import { Text } from './Text'
import { colors, iconSize, radius, space } from './tokens'

/* Grouped rows in the system settings idiom, for the Profile tab: a surface
   card with hairline separators, an eyebrow title above and a faint footer
   below. Rows carry a leading icon, a label, an optional value and a
   trailing mark (chevron for navigation, check for the selected option,
   external for links that leave the app). */

export function SettingsSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement)
  return (
    <View style={styles.section}>
      {title ? (
        <Text variant="eyebrow" style={styles.title}>
          {title}
        </Text>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="small" tone="faint" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  )
}

export type SettingsRowProps = {
  icon?: ReactNode
  label: string
  value?: string
  trailing?: 'chevron' | 'check' | 'external' | ReactNode
  onPress?: () => void
  tone?: 'ink' | 'danger'
  accessibilityHint?: string
}

function Trailing({ trailing }: { trailing: SettingsRowProps['trailing'] }) {
  switch (trailing) {
    case 'chevron':
      return <NextIcon size={iconSize.md} color={colors.inkFaint} />
    case 'check':
      return <CheckIcon size={iconSize.md} weight="bold" color={colors.accentStrong} />
    case 'external':
      return <ForwardIcon size={iconSize.md} color={colors.inkSoft} />
    default:
      return <>{trailing ?? null}</>
  }
}

export function SettingsRow({ icon, label, value, trailing, onPress, tone = 'ink', accessibilityHint }: SettingsRowProps) {
  const body = (
    <>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text tone={tone === 'danger' ? 'danger' : 'ink'} style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      {value ? (
        <Text tone="soft" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      <Trailing trailing={trailing} />
    </>
  )

  if (!onPress) {
    return (
      <View style={styles.row} accessibilityLabel={value ? `${label}, ${value}` : undefined}>
        {body}
      </View>
    )
  }
  return (
    <PressableScale
      onPress={onPress}
      style={styles.row}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={trailing === 'check' ? { selected: true } : undefined}
    >
      {body}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  title: {
    paddingHorizontal: space.xs,
  },
  footer: {
    paddingHorizontal: space.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.lg,
    backgroundColor: colors.line,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  icon: {
    width: iconSize.lg,
    alignItems: 'center',
  },
  label: {
    flex: 1,
  },
  value: {
    flexShrink: 1,
    maxWidth: '45%',
  },
})
