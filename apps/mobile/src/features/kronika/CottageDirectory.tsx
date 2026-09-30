import { useCallback, useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import type { Cottage, StoredState } from '@chatynkowo/core'
import { haptic } from '../../lib/haptics'
import { Button, CloseIcon, CottageIcon, FoundIcon, IconButton, PressableScale, Text, colors, iconSize, radius, space } from '../../ui'

/* Every cottage of the land, behind the Kronika's progress card: the found
   ones first, the newest find on top, then those still waiting in name
   order, with a filter for the waiting ones alone. Picking a row hands the
   entry back to the caller, which opens the tale of a found cottage or
   sends the Atlas to the clue of one still waiting. */

export type DirectoryEntry = {
  cottage: Cottage
  /* When the seeker found it; null while it waits. */
  foundAt: string | null
}

type DirectoryFilter = 'all' | 'undiscovered'

type CottageDirectoryProps = {
  cottages: Cottage[]
  found: StoredState['found']
  onSelect: (entry: DirectoryEntry) => void
  onClose: () => void
}

const ROW_HEIGHT = 56

export function CottageDirectory({ cottages, found, onSelect, onClose }: CottageDirectoryProps) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<DirectoryFilter>('all')

  const entries = useMemo<DirectoryEntry[]>(() => {
    const discovered: Array<{ cottage: Cottage; foundAt: string }> = []
    const waiting: DirectoryEntry[] = []
    for (const cottage of cottages) {
      const find = found[cottage.slug]
      if (find) discovered.push({ cottage, foundAt: find.foundAt })
      else waiting.push({ cottage, foundAt: null })
    }
    /* ISO dates order as strings do. */
    discovered.sort((a, b) => b.foundAt.localeCompare(a.foundAt))
    waiting.sort((a, b) => a.cottage.title.localeCompare(b.cottage.title))
    return [...discovered, ...waiting]
  }, [cottages, found])

  const rows = useMemo(() => (filter === 'all' ? entries : entries.filter((entry) => !entry.foundAt)), [entries, filter])

  const choose = (next: DirectoryFilter) => {
    if (next === filter) return
    haptic('select')
    setFilter(next)
  }

  const renderItem = useCallback(
    ({ item }: { item: DirectoryEntry }) => {
      const { cottage, foundAt } = item
      return (
        <PressableScale haptic="select" onPress={() => onSelect(item)} style={styles.row}>
          {foundAt ? <FoundIcon size={iconSize.md} weight="fill" color={colors.accentStrong} /> : <CottageIcon size={iconSize.md} color={colors.inkSoft} />}
          <View style={styles.rowText}>
            <Text weight="semibold" numberOfLines={1}>
              {cottage.title}
            </Text>
            <Text variant="small" tone="faint" numberOfLines={1}>
              {foundAt ? t('mobile:kronika.foundOn', { date: new Date(foundAt).toLocaleDateString(i18n.resolvedLanguage) }) : t('mobile:kronika.undiscovered')}
            </Text>
          </View>
        </PressableScale>
      )
    },
    [onSelect, t, i18n.resolvedLanguage],
  )

  const filterButton = (value: DirectoryFilter, label: string) => {
    const selected = filter === value
    return (
      <Button variant={selected ? 'primary' : 'subtle'} accessibilityState={{ selected }} onPress={() => choose(value)}>
        {label}
      </Button>
    )
  }

  return (
    <>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text variant="heading" accessibilityRole="header" style={styles.title}>
            {t('mobile:kronika.cottagesTitle')}
          </Text>
          <IconButton label={t('mobile:common.close')} onPress={onClose}>
            <CloseIcon size={iconSize.lg} color={colors.ink} />
          </IconButton>
        </View>
        <View style={styles.filter}>
          {filterButton('all', t('mobile:kronika.showAll'))}
          {filterButton('undiscovered', t('mobile:kronika.showUndiscovered'))}
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(entry) => entry.cottage.slug}
        renderItem={renderItem}
        contentInsetAdjustmentBehavior="never"
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.lg }]}
        accessibilityRole="list"
        ListEmptyComponent={
          <Text tone="soft" style={styles.empty}>
            {filter === 'undiscovered' ? t('mobile:kronika.noneUndiscovered') : t('atlas.emptyTitle')}
          </Text>
        }
      />
    </>
  )
}

const styles = StyleSheet.create({
  head: {
    gap: space.md,
    paddingBottom: space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  title: {
    flex: 1,
  },
  filter: {
    flexDirection: 'row',
    gap: space.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: ROW_HEIGHT,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
  },
  rowText: {
    flex: 1,
  },
  empty: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
})
