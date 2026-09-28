import { useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { EUROPE_BOUNDS, isWithinBounds, nextLevel, type Cottage, type LatLng } from '@chatynkowo/core'
import { AtlasMap, type AtlasMapHandle } from '../../src/features/atlas/AtlasMap'
import { CottageList } from '../../src/features/atlas/CottageList'
import { CottageSheet } from '../../src/features/atlas/CottageSheet'
import { locate } from '../../src/lib/location'
import { openInMaps } from '../../src/lib/navigate'
import { useContent, useProgress } from '../../src/providers'
import {
  AtlasIcon,
  Button,
  IconButton,
  LocateIcon,
  OfflineIcon,
  ResetViewIcon,
  ScreenFrame,
  SearchIcon,
  ShieldIcon,
  Text,
  colors,
  iconSize,
  space,
} from '../../src/ui'

/* The Atlas tab: the map with every cottage, the quest line (stage and the
   next reward), the map controls of the site (reset the frame, my
   position, search) and the cottage sheet on a tapped marker. */
export default function AtlasScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { cottages, rewards, status, offline, stale, refresh, total } = useContent()
  const { state, foundSlugs, foundCount } = useProgress()
  const map = useRef<AtlasMapHandle>(null)
  const [selected, setSelected] = useState<Cottage | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [position, setPosition] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const upcoming = useMemo(() => nextLevel(state, rewards.levels, total), [state, rewards.levels, total])

  async function locateMe() {
    setLocating(true)
    setNotice(null)
    const result = await locate()
    setLocating(false)
    if (result.kind === 'denied') return setNotice(t('mobile:atlas.locateDenied'))
    if (result.kind === 'failed') return setNotice(t('map.locateFail'))
    if (!isWithinBounds(result.position, EUROPE_BOUNDS)) return setNotice(t('map.locateOutside'))
    setPosition(result.position)
    map.current?.showPosition(result.position)
  }

  function pickFromList(cottage: Cottage) {
    setListOpen(false)
    setSelected(cottage)
  }

  return (
    <ScreenFrame scroll={false} padded={false} contentStyle={styles.frame}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="eyebrow">{t('mobile:atlas.title')}</Text>
          <Text variant="title" accessibilityRole="header">
            {foundCount ? t('atlas.headingNext') : t('atlas.headingFirst')}
          </Text>
          {total > 0 ? (
            <>
              <Text variant="eyebrow">{t('quest.stage', { stage: foundCount + 1 })}</Text>
              <Text variant="small" tone="soft">
                {upcoming ? t('quest.nextLevel', { name: upcoming.level.name, count: upcoming.remaining }) : t('quest.allFound')}
              </Text>
            </>
          ) : null}
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
      {notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text variant="small" tone="danger">
            {notice}
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
          <AtlasMap
            ref={map}
            cottages={cottages}
            foundSlugs={foundSlugs}
            selectedSlug={selected?.slug ?? null}
            userPosition={position}
            onSelect={setSelected}
          />
          <View style={styles.controls} accessibilityLabel={t('map.controlsAria')}>
            <IconButton label={t('map.searchLabel')} onPress={() => setListOpen(true)}>
              <SearchIcon size={iconSize.md} color={colors.ink} />
            </IconButton>
            <IconButton label={t('map.resetView')} onPress={() => map.current?.resetView()}>
              <ResetViewIcon size={iconSize.md} color={colors.ink} />
            </IconButton>
            <IconButton label={t('map.locate')} onPress={() => void locateMe()} disabled={locating} active={Boolean(position)}>
              {locating ? <ActivityIndicator color={colors.accentStrong} /> : <LocateIcon size={iconSize.md} color={colors.ink} />}
            </IconButton>
          </View>
        </View>
      )}

      <CottageList visible={listOpen} cottages={cottages} foundSlugs={foundSlugs} onClose={() => setListOpen(false)} onSelect={pickFromList} />
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
  controls: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    gap: space.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
})
