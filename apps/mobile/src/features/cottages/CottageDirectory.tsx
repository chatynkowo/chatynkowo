import { useCallback, useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { formatDay, type Cottage, type StoredState } from '@chatynkowo/core'
import { haptic } from '../../lib/haptics'
import { Button, CloseIcon, CottageIcon, FoundIcon, IconButton, PressableScale, Text, TextField, colors, iconSize, radius, space } from '../../ui'

/* Every cottage of the land in one list, reached from the Atlas's search
   control and the Kronika's progress card: the found ones first, the newest
   find on top, then those still waiting in name order; a search box that
   matches names and residents; a filter for the waiting ones alone. A found
   row shows the day of the find, a waiting one who lives there. Picking a
   row hands the cottage back to the caller, which sends the Atlas to it. */

type Entry = {
  cottage: Cottage
  /* When the seeker found it; null while it waits. */
  foundAt: string | null
}

type DirectoryFilter = 'all' | 'undiscovered'

type CottageDirectoryProps = {
  cottages: Cottage[]
  found: StoredState['found']
  /* Open with the keyboard up on the search box (the Atlas's control). */
  searching?: boolean
  onSelect: (cottage: Cottage) => void
  onClose: () => void
}

const ROW_HEIGHT = 56

export function CottageDirectory({ cottages, found, searching = false, onSelect, onClose }: CottageDirectoryProps) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DirectoryFilter>('all')

  const entries = useMemo<Entry[]>(() => {
    const discovered: Array<{ cottage: Cottage; foundAt: string }> = []
    const waiting: Entry[] = []
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

  /* The name first, then the filter, so an empty list knows which of the
     two emptied it. */
  const needle = query.trim().toLocaleLowerCase()
  const named = useMemo(
    () => (needle ? entries.filter(({ cottage }) => `${cottage.title} ${cottage.occupant}`.toLocaleLowerCase().includes(needle)) : entries),
    [entries, needle],
  )
  const rows = useMemo(() => (filter === 'all' ? named : named.filter((entry) => !entry.foundAt)), [named, filter])

  const choose = (next: DirectoryFilter) => {
    if (next === filter) return
    haptic('select')
    setFilter(next)
  }

  const renderItem = useCallback(
    ({ item: { cottage, foundAt } }: { item: Entry }) => (
      <PressableScale haptic="select" onPress={() => onSelect(cottage)} style={styles.row}>
        {foundAt ? <FoundIcon size={iconSize.md} weight="fill" color={colors.accentStrong} /> : <CottageIcon size={iconSize.md} color={colors.inkSoft} />}
        <View style={styles.rowText}>
          <Text weight="semibold" numberOfLines={1}>
            {cottage.title}
          </Text>
          <Text variant="small" tone="faint" numberOfLines={1}>
            {foundAt
              ? t('mobile:cottages.foundOn', { date: formatDay(foundAt, i18n.resolvedLanguage ?? i18n.language) })
              : `${t('map.residentPrefix')} ${cottage.occupant || t('map.defaultOccupant')}`}
          </Text>
        </View>
      </PressableScale>
    ),
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

  /* Nothing to show: the name matches only found cottages the filter hides,
     no such name, every cottage found, or none loaded yet. */
  const emptyText = needle
    ? named.length
      ? t('mobile:cottages.hiddenByFilter')
      : t('map.searchMiss')
    : filter === 'undiscovered'
      ? t('mobile:cottages.noneUndiscovered')
      : t('atlas.emptyTitle')

  return (
    <>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text variant="heading" accessibilityRole="header" style={styles.title}>
            {t('mobile:cottages.title')}
          </Text>
          <IconButton label={t('mobile:common.close')} onPress={onClose}>
            <CloseIcon size={iconSize.lg} color={colors.ink} />
          </IconButton>
        </View>
        <TextField
          label={t('map.searchLabel')}
          value={query}
          onChangeText={setQuery}
          autoFocus={searching}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <View style={styles.filter}>
          {filterButton('all', t('mobile:cottages.showAll'))}
          {filterButton('undiscovered', t('mobile:cottages.showUndiscovered'))}
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(entry) => entry.cottage.slug}
        renderItem={renderItem}
        contentInsetAdjustmentBehavior="never"
        /* iOS lifts the list's end above the keyboard; Android resizes the window. */
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.lg }]}
        accessibilityRole="list"
        ListEmptyComponent={
          <Text tone="soft" style={styles.empty}>
            {emptyText}
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
