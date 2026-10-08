import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { formatElapsed } from '@chatynkowo/core'
import type { LeaderboardRow as Row } from '@chatynkowo/api'
import { Avatar, Text, colors, enterDown, radius, space } from '../../ui'

/* One line of the leaderboard: place, avatar or initials, name, found count
   and the expedition time, the same rules as the site's ranking page. The
   height is fixed so the list can lay rows out without measuring them. */

export const LEADERBOARD_ROW_HEIGHT = 64
const AVATAR = 40

/* Rows of the first screenful slide in one after another; rows mounted
   later while scrolling appear at once. */
const ANIMATED_ROWS = 12
const STAGGER_MS = 40
const MAX_STAGGER_STEPS = 8

type LeaderboardRowProps = { row: Row; place: number; total: number; mine: boolean }

export const LeaderboardRow = memo(function LeaderboardRow({ row, place, total, mine }: LeaderboardRowProps) {
  const { t } = useTranslation()
  const elapsed = formatElapsed(row.elapsed_seconds)
  const time = t('ranking.time', { value: elapsed ?? t('ranking.noTime') })
  const entering = place <= ANIMATED_ROWS ? enterDown(Math.min(place - 1, MAX_STAGGER_STEPS) * STAGGER_MS) : undefined
  /* One element per row for the screen reader: place, name, count, time. */
  const label = [`${place}.`, row.display_name + (mine ? ` ${t('ranking.you')}` : ''), `${row.found}/${total}`, time].join(', ')
  return (
    <Animated.View entering={entering} style={[styles.row, mine && styles.rowMine]} accessible accessibilityLabel={label}>
      <Text variant="heading" tone={place <= 3 ? 'accent' : 'faint'} style={styles.place}>
        {place}
      </Text>
      <Avatar name={row.display_name} uri={row.avatar_url} size={AVATAR} />
      <View style={styles.name}>
        <Text weight={mine ? 'bold' : 'semibold'} numberOfLines={1}>
          {row.display_name}
          {mine ? ` ${t('ranking.you')}` : ''}
        </Text>
        <Text variant="small" tone="faint" numberOfLines={1}>
          {time}
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
  name: {
    flex: 1,
  },
})
