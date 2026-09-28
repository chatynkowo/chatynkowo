import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { AtlasMap } from '../../src/features/atlas/AtlasMap'
import { CottageSheet } from '../../src/features/atlas/CottageSheet'
import { openInMaps } from '../../src/lib/navigate'
import { useContent, useProgress } from '../../src/providers'
import { AtlasIcon, Button, OfflineIcon, ScreenFrame, ShieldIcon, Text, colors, iconSize, space } from '../../src/ui'

/* The Atlas tab: the map with every cottage, the seeker's tally, and the
   cottage sheet on a tapped marker. */
export default function AtlasScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { cottages, status, offline, stale, refresh, total } = useContent()
  const { foundSlugs, foundCount } = useProgress()
  const [selected, setSelected] = useState<Cottage | null>(null)

  return (
    <ScreenFrame scroll={false} padded={false} contentStyle={styles.frame}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="eyebrow">{t('mobile:atlas.title')}</Text>
          <Text variant="title" accessibilityRole="header">
            {foundCount ? t('atlas.headingNext') : t('atlas.headingFirst')}
          </Text>
        </View>
        {total > 0 ? (
          <Text weight="bold" tone="accent">
            {t('mobile:atlas.progress', { found: foundCount, total })}
          </Text>
        ) : null}
      </View>
      {(offline || stale) && status === 'ready' ? (
        <View style={styles.notice}>
          <OfflineIcon size={iconSize.sm} color={colors.inkSoft} />
          <Text variant="small" tone="soft">
            {t('mobile:common.offline')}
          </Text>
        </View>
      ) : null}

      {status === 'loading' ? (
        <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={t('atlas.loadingAria')}>
          <ActivityIndicator color={colors.accentStrong} size="large" />
          <Text tone="soft">{t('atlas.loading')}</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.center} accessibilityRole="alert">
          <ShieldIcon size={iconSize.hero} color={colors.accentStrong} />
          <Text variant="heading" align="center">
            {t('atlas.errorTitle')}
          </Text>
          <Text tone="soft" align="center">
            {offline ? t('mobile:common.offlineNoData') : t('atlas.errorBody')}
          </Text>
          <Button variant="primary" onPress={() => void refresh()}>
            {t('mobile:common.retry')}
          </Button>
        </View>
      ) : cottages.length === 0 ? (
        <View style={styles.center}>
          <AtlasIcon size={iconSize.hero} color={colors.accentStrong} />
          <Text variant="heading" align="center">
            {t('atlas.emptyTitle')}
          </Text>
        </View>
      ) : (
        <View style={styles.map} accessibilityLabel={t('map.interactiveAria')}>
          <AtlasMap cottages={cottages} foundSlugs={foundSlugs} selectedSlug={selected?.slug ?? null} onSelect={setSelected} />
        </View>
      )}

      <CottageSheet
        cottage={selected}
        found={selected ? foundSlugs.has(selected.slug) : false}
        onClose={() => setSelected(null)}
        onNavigate={(cottage) => void openInMaps(cottage, cottage.title)}
        onHaveCode={() => {
          setSelected(null)
          router.push('/code')
        }}
        onOpenStory={(cottage) => {
          setSelected(null)
          router.push({ pathname: '/story/[slug]', params: { slug: cottage.slug, revisit: '1' } })
        }}
      />
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  frame: {
    paddingTop: space.md,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  headerText: {
    flex: 1,
    gap: space.xs,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  map: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
})
