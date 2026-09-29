import { useCallback, useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { CottageIcon, FoundIcon, PressableScale, Text, TextField, colors, iconSize, radius, space } from '../../ui'

/* Every cottage by name, with a search box: the site's map search inside
   the search sheet. Picking one hands it back to the caller, which sends
   the Atlas to it. */

type SearchListProps = {
  cottages: Cottage[]
  foundSlugs: Set<string>
  onSelect: (cottage: Cottage) => void
}

const ROW_HEIGHT = 56

export function SearchList({ cottages, foundSlugs, onSelect }: SearchListProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const sorted = useMemo(() => [...cottages].sort((a, b) => a.title.localeCompare(b.title)), [cottages])
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return needle ? sorted.filter((cottage) => `${cottage.title} ${cottage.occupant}`.toLocaleLowerCase().includes(needle)) : sorted
  }, [sorted, query])

  const renderItem = useCallback(
    ({ item }: { item: Cottage }) => {
      const found = foundSlugs.has(item.slug)
      return (
        <PressableScale accessibilityLabel={t('map.openMarker', { title: item.title })} onPress={() => onSelect(item)} haptic="select" style={styles.row}>
          {found ? <FoundIcon size={iconSize.md} weight="fill" color={colors.accentStrong} /> : <CottageIcon size={iconSize.md} color={colors.inkSoft} />}
          <View style={styles.rowText}>
            <Text weight="semibold" numberOfLines={1}>
              {item.title}
            </Text>
            <Text variant="small" tone="faint" numberOfLines={1}>
              {t('map.residentPrefix')} {item.occupant || t('map.defaultOccupant')}
            </Text>
          </View>
        </PressableScale>
      )
    },
    [foundSlugs, onSelect, t],
  )

  /* One scroll view holds the heading, the field and the rows, so the
     keyboard avoidance of the form sheet scrolls the field and the matches
     together. */
  const header = (
    <View style={styles.head}>
      <Text variant="heading" accessibilityRole="header">
        {t('mobile:atlas.list')}
      </Text>
      <TextField
        label={t('map.searchLabel')}
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  )

  return (
    <FlatList
      data={matches}
      keyExtractor={(item) => item.slug}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.lg }]}
      ListEmptyComponent={
        <Text tone="soft" style={styles.miss}>
          {t('map.searchMiss')}
        </Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  head: {
    gap: space.md,
    paddingBottom: space.md,
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
  miss: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
})
