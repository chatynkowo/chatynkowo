import { Image, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { initials } from '@chatynkowo/core'
import type { LeaderboardRow } from '@chatynkowo/api'
import { Text, colors, radius, space } from '../../ui'

/* The top three, second and third flanking the winner — the site's podium. */
export function Podium({ rows, total, isMine }: { rows: LeaderboardRow[]; total: number; isMine: (row: LeaderboardRow) => boolean }) {
  const { t } = useTranslation()
  if (rows.length < 3) return null
  const order: Array<{ row: LeaderboardRow; place: number }> = [
    { row: rows[1], place: 2 },
    { row: rows[0], place: 1 },
    { row: rows[2], place: 3 },
  ]
  return (
    <View style={styles.podium} accessibilityLabel={t('ranking.podiumAria')}>
      {order.map(({ row, place }) => (
        <View key={row.public_id} style={[styles.card, place === 1 && styles.cardFirst, isMine(row) && styles.cardMine]}>
          <Text variant="title" tone="accent">
            {place}
          </Text>
          {row.avatar_url ? (
            <Image source={{ uri: row.avatar_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.avatar, styles.avatarInitials]}>
              <Text weight="bold" tone="accent">
                {initials(row.display_name)}
              </Text>
            </View>
          )}
          <Text weight="bold" numberOfLines={2} align="center">
            {row.display_name}
          </Text>
          <Text variant="small" tone="soft">
            {row.found}/{total}
          </Text>
          <Text variant="small" tone="faint">
            {t('ranking.place', { place })}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardFirst: {
    paddingVertical: space.xl,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surfaceSoft,
  },
  cardMine: {
    borderColor: colors.accentStrong,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pageRaised,
  },
  avatarInitials: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
})
