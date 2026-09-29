import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { finalLevelId, kronikaLevels, nextLevel, requiredFinds, type RewardLevel } from '@chatynkowo/core'
import { CollectionHeader } from '../../../src/features/kronika/CollectionHeader'
import { RewardCard } from '../../../src/features/kronika/RewardCard'
import { useContent, useProgress } from '../../../src/providers'
import { ChronicleIcon, EmptyState, LinkButton, SkeletonCard, colors, space } from '../../../src/ui'

/* The Kronika tab: the collection of reward levels, earned and still locked,
   as a two-column grid under a large native title, with the progress card
   and the published intro above it. Seals earned since the last visit are
   marked "new" for this visit and then counted as seen, which clears the
   tab badge. The full set unlocks the ranking invite at the bottom. */

const SKELETON_CELLS = 4

/* How long the "new" ribbon glows before the seals count as seen. */
const MARK_SEEN_DELAY_MS = 600

/* A grid cell: a level, or the blank that squares off an odd last row. */
type Cell = { kind: 'level'; level: RewardLevel } | { kind: 'blank' } | { kind: 'skeleton'; id: number }

const BLANK: Cell = { kind: 'blank' }

function sameIds(a: Set<string>, b: string[]) {
  return a.size === b.length && b.every((id) => a.has(id))
}

export default function KronikaScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { rewards, total, status, refresh } = useContent()
  const { state, foundCount, hydrated, unseenRewards, markRewardsSeen } = useProgress()
  const [refreshing, setRefreshing] = useState(false)

  const levels = useMemo(() => kronikaLevels(rewards.levels, state.badges), [rewards.levels, state.badges])
  const next = useMemo(() => nextLevel(state, rewards.levels, total), [state, rewards.levels, total])
  const completed = total > 0 && Boolean(state.badges[finalLevelId(rewards.levels)])
  const loading = !hydrated || (levels.length === 0 && status === 'loading')

  /* The ribbons of this visit: the unseen ids as they were when the tab
     focused, kept while the provider already counts them as seen. */
  const [highlighted, setHighlighted] = useState<Set<string>>(() => new Set())
  const unseenRef = useRef(unseenRewards)
  useEffect(() => {
    unseenRef.current = unseenRewards
  })
  useFocusEffect(
    useCallback(() => {
      const ids = unseenRef.current
      setHighlighted((current) => (sameIds(current, ids) ? current : new Set(ids)))
      if (!ids.length) return
      const timer = setTimeout(markRewardsSeen, MARK_SEEN_DELAY_MS)
      return () => clearTimeout(timer)
    }, [markRewardsSeen]),
  )

  /* Cards stagger in on the first frame that has them; anything mounted
     later (a language switch, a content update) appears in place. */
  const entered = useRef(false)
  useEffect(() => {
    if (levels.length) entered.current = true
  }, [levels.length])
  const animateEntrance = !entered.current

  const cells = useMemo<Cell[]>(() => {
    if (loading) return Array.from({ length: SKELETON_CELLS }, (_, id) => ({ kind: 'skeleton', id }))
    const list: Cell[] = levels.map((level) => ({ kind: 'level', level }))
    if (list.length % 2 === 1) list.push(BLANK)
    return list
  }, [loading, levels])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh({ force: true })
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  const openReward = useCallback((id: string) => router.push({ pathname: '/reward/[id]', params: { id } }), [router])

  const renderCell = useCallback(
    ({ item, index }: { item: Cell; index: number }) => {
      if (item.kind === 'blank') return <View style={styles.blank} />
      if (item.kind === 'skeleton') {
        return (
          <View style={styles.blank}>
            <SkeletonCard />
          </View>
        )
      }
      const { level } = item
      return (
        <RewardCard
          level={level}
          earned={Boolean(state.badges[level.id])}
          found={foundCount}
          required={requiredFinds(level, total)}
          unseen={highlighted.has(level.id)}
          enterIndex={animateEntrance ? index : null}
          onPress={() => openReward(level.id)}
        />
      )
    },
    [state.badges, foundCount, total, highlighted, animateEntrance, openReward],
  )

  const header = (
    <CollectionHeader
      found={foundCount}
      total={total}
      next={next}
      intro={rewards.treasury.intro}
      note={foundCount ? t('treasury.fallbackProgress', { found: foundCount, total }) : null}
    />
  )

  const footer = completed ? (
    <View style={styles.footer}>
      <LinkButton variant="primary" block href="/ranking">
        {t('treasury.seeRanking')}
      </LinkButton>
    </View>
  ) : foundCount === 0 && !loading ? (
    <EmptyState icon={ChronicleIcon} title={t('quest.chronicle')} body={t('treasury.fallbackEmpty')} action={{ label: t('map.haveCode'), onPress: () => router.push('/code') }} />
  ) : null

  return (
    <>
      <Stack.Screen options={{ title: rewards.treasury.title || t('quest.chronicle') }} />
      <FlatList
        data={cells}
        keyExtractor={(cell, index) => (cell.kind === 'level' ? cell.level.id : `${cell.kind}-${index}`)}
        renderItem={renderCell}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        accessibilityRole="list"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
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
    paddingTop: space.lg,
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  row: {
    gap: space.md,
  },
  blank: {
    flex: 1,
  },
  footer: {
    paddingTop: space.sm,
  },
})
