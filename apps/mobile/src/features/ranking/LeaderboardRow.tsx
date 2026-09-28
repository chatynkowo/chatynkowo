import { Image, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { formatElapsed, initials } from '@chatynkowo/core'
import type { LeaderboardRow as Row } from '@chatynkowo/api'
import { Text, colors, radius, space } from '../../ui'

/* One line of the leaderboard: place, avatar or initials, name, found count
   and the expedition time — the same rules as the site's ranking page. */
export function LeaderboardRow({ row, place, total, mine }: { row: Row; place: number; total: number; mine: boolean }) {
  const { t } = useTranslation()
  const elapsed = formatElapsed(row.elapsed_seconds)
  return (
    <View style={[styles.row, mine && styles.rowMine]} accessibilityRole="text">
      <Text variant="heading" tone={place <= 3 ? 'accent' : 'faint'} style={styles.place}>
        {place}
      </Text>
      {row.avatar_url ? (
        <Image source={{ uri: row.avatar_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.avatar, styles.avatarInitials]}>
          <Text variant="small" weight="bold" tone="accent">
            {initials(row.display_name)}
          </Text>
        </View>
      )}
      <View style={styles.name}>
        <Text weight={mine ? 'bold' : 'semibold'} numberOfLines={1}>
          {row.display_name}
          {mine ? ` ${t('ranking.you')}` : ''}
        </Text>
        <Text variant="small" tone="faint">
          {t('ranking.time', { value: elapsed ?? t('ranking.noTime') })}
        </Text>
      </View>
      <Text weight="bold" tone={row.completed ? 'accent' : 'ink'}>
        {row.found}
        <Text variant="small" tone="faint">
          /{total}
        </Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
  },
  rowMine: {
    backgroundColor: colors.accentWash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  place: {
    width: 32,
    textAlign: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
  },
  avatarInitials: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  name: {
    flex: 1,
  },
})
