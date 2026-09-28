import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { EUROPE_BOUNDS, isWithinBounds, nextLevel, type Cottage } from '@chatynkowo/core'
import { AtlasMap, LEVEL_KEYS, type AtlasMapHandle, type MapPresentation } from '../../src/features/atlas/AtlasMap'
import { CottageList } from '../../src/features/atlas/CottageList'
import { CottagePanel } from '../../src/features/atlas/CottagePanel'
import { ControlBar, LevelCard, MapTip } from '../../src/features/atlas/MapChrome'
import { MapVignette } from '../../src/features/atlas/MapVignette'
import { locate, type Position } from '../../src/lib/location'
import { openInMaps } from '../../src/lib/navigate'
import { useContent, useProgress } from '../../src/providers'
import {
  AtlasIcon,
  Button,
  LocateIcon,
  OfflineIcon,
  ResetViewIcon,
  ScreenFrame,
  SearchIcon,
  ShieldIcon,
  Text,
  colors,
  iconSize,
  mapPalette,
  radius,
  space,
} from '../../src/ui'

const DEFAULT_PANEL_HEIGHT = 320

/* The Atlas tab: the quest line, then the site's fairy-tale map in its
   frame — the level indicator, the search, reset and locate controls, the
   tip, and the parchment panel that rises when a marker is chosen. */
export default function AtlasScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { cottages, rewards, status, offline, stale, refresh, total } = useContent()
  const { state, foundSlugs, foundCount } = useProgress()
  const map = useRef<AtlasMapHandle>(null)
  const panelHeight = useRef(DEFAULT_PANEL_HEIGHT)
  const [selected, setSelected] = useState<Cottage | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [presentation, setPresentation] = useState<MapPresentation>({ level: 'kraj', reality: 0 })

  const upcoming = useMemo(() => nextLevel(state, rewards.levels, total), [state, rewards.levels, total])
  const onPresentationChange = useCallback((next: MapPresentation) => {
    setPresentation((current) => (current.level === next.level && Math.abs(current.reality - next.reality) < 0.02 ? current : next))
  }, [])

  function choose(cottage: Cottage) {
    setListOpen(false)
    setSelected(cottage)
    map.current?.frameCottage(cottage, panelHeight.current + space.lg)
  }

  function closePanel() {
    setSelected(null)
    map.current?.releasePadding()
  }

  function onPanelLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height
    if (Math.abs(height - panelHeight.current) > 8) {
      panelHeight.current = height
      if (selected) map.current?.frameCottage(selected, height + space.lg)
    }
  }

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

  const controls = [
    { key: 'reset', label: t('map.resetView'), icon: <ResetViewIcon size={iconSize.md} color={mapPalette.chromeIcon} />, onPress: () => { closePanel(); map.current?.resetView() } },
    {
      key: 'locate',
      label: t('map.locate'),
      icon: locating ? <ActivityIndicator color={mapPalette.chromeIcon} /> : <LocateIcon size={iconSize.md} color={mapPalette.chromeIcon} />,
      onPress: () => void locateMe(),
      disabled: locating,
    },
  ]

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
        <View style={styles.explorer} accessibilityLabel={t('map.interactiveAria')}>
          <AtlasMap
            ref={map}
            cottages={cottages}
            foundSlugs={foundSlugs}
            selectedSlug={selected?.slug ?? null}
            userPosition={position}
            onSelect={choose}
            onPresentationChange={onPresentationChange}
          />
          <MapVignette reality={presentation.reality} />
          <View style={styles.topbar} pointerEvents="box-none">
            <LevelCard label={t('map.levelLabel')} level={t(LEVEL_KEYS[presentation.level])} />
            <ControlBar controls={[{ key: 'search', label: t('map.searchLabel'), icon: <SearchIcon size={iconSize.md} color={mapPalette.chromeIcon} />, onPress: () => setListOpen(true) }]} />
          </View>
          {notice ? (
            <View style={styles.alert} accessibilityLiveRegion="polite">
              <Text variant="small" style={styles.alertText}>
                {notice}
              </Text>
            </View>
          ) : null}
          {selected ? null : (
            <View style={styles.bottombar} pointerEvents="box-none">
              <ControlBar controls={controls} />
              <View style={styles.tip}>
                <MapTip>{t('map.tip')}</MapTip>
              </View>
            </View>
          )}
          {selected ? (
            <CottagePanel
              cottage={selected}
              found={foundSlugs.has(selected.slug)}
              onClose={closePanel}
              onNavigate={(cottage) => void openInMaps(cottage, cottage.title)}
              onHaveCode={() => {
                closePanel()
                router.push('/code')
              }}
              onOpenStory={(cottage) => {
                closePanel()
                router.push({ pathname: '/story/[slug]', params: { slug: cottage.slug, revisit: '1' } })
              }}
              onLayout={onPanelLayout}
            />
          ) : null}
        </View>
      )}

      <CottageList visible={listOpen} cottages={cottages} foundSlugs={foundSlugs} onClose={() => setListOpen(false)} onSelect={choose} />
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
  explorer: {
    flex: 1,
    marginHorizontal: space.md,
    marginBottom: space.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.card,
    backgroundColor: mapPalette.frame,
  },
  topbar: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  alert: {
    position: 'absolute',
    top: 84,
    left: space.lg,
    right: space.lg,
    padding: space.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.control,
    backgroundColor: mapPalette.chrome,
  },
  alertText: {
    color: colors.danger,
  },
  bottombar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  tip: {
    flex: 1,
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
})
