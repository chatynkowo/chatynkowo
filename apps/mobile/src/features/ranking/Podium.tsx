import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import type { LeaderboardRow } from '@chatynkowo/api'
import { Avatar, GlowPulse, Text, colors, enterUp, radius, space } from '../../ui'

/* The top three, second and third flanking the winner, the site's podium.
   The cards rise in third, second, first order the first time they appear
   and the winner's avatar glows; a refetch that keeps the same people
   leaves them still. */

const AVATAR = 48

/* Entrance delay per place: the winner comes last. */
const ENTER_DELAY_MS: Record<number, number> = { 3: 0, 2: 80, 1: 160 }

type PodiumProps = { rows: LeaderboardRow[]; total: number; isMine: (row: LeaderboardRow) => boolean }

export const Podium = memo(function Podium({ rows, total, isMine }: PodiumProps) {
  const { t } = useTranslation()
  if (rows.length < 3) return null
  const order: Array<{ row: LeaderboardRow; place: number }> = [
    { row: rows[1], place: 2 },
    { row: rows[0], place: 1 },
    { row: rows[2], place: 3 },
  ]
  return (
    <View style={styles.podium}>
      {order.map(({ row, place }) => {
        const avatar = <Avatar name={row.display_name} uri={row.avatar_url} size={AVATAR} />
        return (
          <Animated.View
            key={row.public_id}
            entering={enterUp(ENTER_DELAY_MS[place] ?? 0)}
            style={[styles.card, place === 1 && styles.cardFirst, isMine(row) && styles.cardMine]}
            accessible
            accessibilityLabel={[t('ranking.place', { place }), row.display_name + (isMine(row) ? ` ${t('ranking.you')}` : ''), `${row.found}/${total}`].join(', ')}
          >
            <Text variant="title" tone="accent">
              {place}
            </Text>
            {place === 1 ? <GlowPulse size={AVATAR}>{avatar}</GlowPulse> : avatar}
            <Text weight="bold" numberOfLines={2} align="center">
              {row.display_name}
            </Text>
            <Text variant="small" tone="soft">
              {row.found}/{total}
            </Text>
            <Text variant="small" tone="faint">
              {t('ranking.place', { place })}
            </Text>
          </Animated.View>
        )
      })}
    </View>
  )
})

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
})
