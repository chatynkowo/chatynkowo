import { useCallback, useMemo } from 'react'
import { Platform, RefreshControl, Share, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Stack, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { rankingShareUrl } from '@chatynkowo/core'
import type { LeaderboardRow as Row } from '@chatynkowo/api'
import { AccountRow } from '../../../src/features/ranking/AccountRow'
import { LEADERBOARD_ROW_HEIGHT, LeaderboardRow } from '../../../src/features/ranking/LeaderboardRow'
import { Podium } from '../../../src/features/ranking/Podium'
import { useLeaderboard } from '../../../src/features/ranking/useLeaderboard'
import { haptic } from '../../../src/lib/haptics'
import { useContent, useOnline, useProgress, useSession } from '../../../src/providers'
import { EmptyState, RewardIcon, ShieldIcon, SkeletonRow, Text, colors, headerRightItems, layoutLinear, space, type HeaderItemSpec } from '../../../src/ui'

/* The Ranking tab: the site's leaderboard as a native list under a large
   title. The account block sits at the top (sign-in, or the seeker's place
   and the state of the exchange with the account), then the podium and
   every seeker in order. The rules open from the header's info item and a
   shareable result from the share item once the seeker has a profile. */

const SKELETON_ROWS = 6
const INITIAL_ROWS = 12

export default function RankingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { total } = useContent()
  const online = useOnline()
  const { foundCount } = useProgress()
  const account = useSession()
  const { rows, updatedAt, refreshing, error, refresh } = useLeaderboard(total)

  const myId = account.profile?.public_id ?? null
  const isMine = useCallback((row: Row) => row.public_id === myId, [myId])
  const myIndex = useMemo(() => (myId ? rows.findIndex((row) => row.public_id === myId) : -1), [rows, myId])
  const place = myIndex >= 0 ? myIndex + 1 : null

  const shareResult = useCallback(async () => {
    if (!myId) return
    const url = rankingShareUrl(myId)
    haptic('light')
    try {
      await Share.share(Platform.OS === 'ios' ? { message: t('ranking.shareText'), url } : { message: `${t('ranking.shareText')} ${url}` })
    } catch {
      // The share sheet was dismissed.
    }
  }, [myId, t])

  const headerItems = useMemo<HeaderItemSpec[]>(() => {
    const items: HeaderItemSpec[] = [{ role: 'info', label: t('mobile:ranking.rules'), onPress: () => router.push('/rules') }]
    if (myId) items.push({ role: 'share', label: t('ranking.share'), onPress: () => void shareResult() })
    return items
  }, [t, router, myId, shareResult])

  const onSignedIn = useCallback(() => void refresh({ silent: true }), [refresh])

  const renderRow = useCallback(
    ({ item, index }: { item: Row; index: number }) => <LeaderboardRow row={item} place={index + 1} total={total} mine={isMine(item)} />,
    [total, isMine],
  )

  const header = (
    <View style={styles.header}>
      <View style={styles.lead}>
        <Text variant="eyebrow">{t('ranking.eyebrow')}</Text>
        <Text tone="soft">{t('ranking.lede')}</Text>
      </View>
      <AccountRow place={place} onSignedIn={onSignedIn} />
      {rows.length >= 3 ? (
        <View style={styles.board}>
          <View style={styles.boardHeader}>
            <Text variant="eyebrow">{t('ranking.topEyebrow')}</Text>
            <Text variant="heading" accessibilityRole="header">
              {t('ranking.topTitle')}
            </Text>
            <Text variant="small" tone="faint">
              {t('ranking.topNote')}
            </Text>
          </View>
          <Podium rows={rows} total={total} isMine={isMine} />
        </View>
      ) : null}
      {rows.length ? (
        <View style={styles.boardHeader}>
          <Text variant="heading" accessibilityRole="header">
            {t('ranking.allTitle')}
          </Text>
          <Text variant="small" tone="faint">
            {t('ranking.allSubtitle')}
          </Text>
        </View>
      ) : null}
    </View>
  )

  /* Rows are never cleared by a refetch, so this only shows before the
     first success: a skeleton while fetching, the reason when it failed, an
     invitation when the board is empty. */
  const empty = error ? (
    <EmptyState
      icon={ShieldIcon}
      title={online === false ? t('mobile:common.offlineNoData') : t('ranking.loadError')}
      action={{ label: t('mobile:common.retry'), onPress: () => void refresh() }}
    />
  ) : updatedAt === null ? (
    <View accessibilityLabel={t('ranking.loading')}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </View>
  ) : (
    <EmptyState
      icon={RewardIcon}
      title={t('ranking.empty')}
      body={foundCount === 0 ? t('ranking.continueBody') : undefined}
      action={{ label: t('map.haveCode'), onPress: () => router.push('/code') }}
    />
  )

  return (
    <>
      <Stack.Screen options={{ title: t('ranking.title'), ...headerRightItems(headerItems) }} />
      <Animated.FlatList
        data={rows}
        keyExtractor={(row) => row.public_id}
        renderItem={renderRow}
        getItemLayout={(_, index) => ({ length: LEADERBOARD_ROW_HEIGHT, offset: LEADERBOARD_ROW_HEIGHT * index, index })}
        initialNumToRender={INITIAL_ROWS}
        itemLayoutAnimation={layoutLinear}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accentStrong}
            colors={[colors.accentStrong]}
            progressBackgroundColor={colors.pageRaised}
          />
        }
      />
    </>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  header: {
    gap: space.xl,
    paddingBottom: space.md,
  },
  lead: {
    gap: space.xs,
  },
  board: {
    gap: space.sm,
  },
  boardHeader: {
    gap: space.xs,
  },
})
