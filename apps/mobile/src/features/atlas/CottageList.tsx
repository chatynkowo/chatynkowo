import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { CottageIcon, FoundIcon, Sheet, Text, TextField, colors, iconSize, radius, space } from '../../ui'

/* Every cottage by name, with a search box — the site's map search as a
   sheet. Picking one hands it to the Atlas, which frames it. */
type CottageListProps = {
  visible: boolean
  cottages: Cottage[]
  foundSlugs: Set<string>
  onClose: () => void
  onSelect: (cottage: Cottage) => void
}

export function CottageList({ visible, cottages, foundSlugs, onClose, onSelect }: CottageListProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const sorted = [...cottages].sort((a, b) => a.title.localeCompare(b.title))
    return needle ? sorted.filter((cottage) => `${cottage.title} ${cottage.occupant}`.toLocaleLowerCase().includes(needle)) : sorted
  }, [cottages, query])

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t('map.closePanel')} title={t('mobile:atlas.list')}>
      <TextField label={t('map.searchLabel')} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
      {matches.length ? (
        <View style={styles.list} accessibilityRole="list">
          {matches.map((cottage) => {
            const found = foundSlugs.has(cottage.slug)
            return (
              <Pressable
                key={cottage.slug}
                accessibilityRole="button"
                accessibilityLabel={t('map.openMarker', { title: cottage.title })}
                onPress={() => onSelect(cottage)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                {found ? (
                  <FoundIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
                ) : (
                  <CottageIcon size={iconSize.md} color={colors.inkSoft} />
                )}
                <View style={styles.rowText}>
                  <Text weight="semibold">{cottage.title}</Text>
                  <Text variant="small" tone="faint">
                    {t('map.residentPrefix')} {cottage.occupant || t('map.defaultOccupant')}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <Text tone="soft">{t('map.searchMiss')}</Text>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
  },
  rowPressed: {
    backgroundColor: colors.accentWash,
  },
  rowText: {
    flex: 1,
  },
})
