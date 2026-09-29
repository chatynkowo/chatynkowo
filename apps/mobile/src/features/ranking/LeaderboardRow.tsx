import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { formatElapsed, initials } from '@chatynkowo/core'
import type { LeaderboardRow as Row } from '@chatynkowo/api'
import { ContentImage, Text, colors, enterDown, radius, space } from '../../ui'

/* One line of the leaderboard: place, avatar or initials, name, found count
   and the expedition time, the same rules as the site's ranking page. The
   height is fixed so the list can lay rows out without measuring them. */

export const LEADERBOARD_ROW_HEIGHT = 64

/* Rows of the first screenful slide in one after another; rows mounted
   later while scrolling appear at once. */
const ANIMATED_ROWS = 12
const STAGGER_MS = 40
const MAX_STAGGER_STEPS = 8

type LeaderboardRowProps = { row: Row; place: number; total: number; mine: boolean }

export const LeaderboardRow = memo(function LeaderboardRow({ row, place, total, mine }: LeaderboardRowProps) {
  const { t } = useTranslation()
  const elapsed = formatElapsed(row.elapsed_seconds)
  const entering = place <= ANIMATED_ROWS ? enterDown(Math.min(place - 1, MAX_STAGGER_STEPS) * STAGGER_MS) : undefined
  return (
    <Animated.View entering={entering} style={[styles.row, mine && styles.rowMine]} accessibilityRole="text">
      <Text variant="heading" tone={place <= 3 ? 'accent' : 'faint'} style={styles.place}>
        {place}
      </Text>
      {row.avatar_url ? (
        <ContentImage uri={row.avatar_url} radius={radius.pill} style={styles.avatar} />
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
        <Text variant="small" tone="faint" numberOfLines={1}>
          {t('ranking.time', { value: elapsed ?? t('ranking.noTime') })}
        </Text>
      </View>
      <Text weight="bold" tone={row.completed ? 'accent' : 'ink'}>
        {row.found}
        <Text variant="small" tone="faint">
          /{total}
        </Text>
      </Text>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  row: {
    height: LEADERBOARD_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowMine: {
    backgroundColor: colors.accentWash,
    borderColor: colors.lineStrong,
  },
  place: {
    width: 32,
    textAlign: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
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
