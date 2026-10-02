import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import Animated, { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { nearestPlace, nextLevel, type Cottage, type LatLng } from '@chatynkowo/core'
import { AtlasMap, LEVEL_KEYS, type AtlasMapHandle, type FrameMode, type MapLevel, type OutOfSight } from '../../src/features/atlas/AtlasMap'
import { CottageSheet, sheetHeightForIndex, type CottageSheetHandle, type SnapIndex } from '../../src/features/atlas/CottageSheet'
import { ControlBar, LevelCard, MapTip, NearestBeacon, StatusPill, formatDistance } from '../../src/features/atlas/MapChrome'
import { MapVignette } from '../../src/features/atlas/MapVignette'
import { QuestCard } from '../../src/features/atlas/QuestCard'
import { useAtlasFocus, type FocusReason } from '../../src/features/atlas/useAtlasFocus'
import { useLocate } from '../../src/features/atlas/useLocate'
import { announce } from '../../src/lib/announce'
import { useContent, useOnline, useProgress, useToast } from '../../src/providers'
import {
  AtlasIcon,
  colors,
  DURATIONS,
  EmptyState,
  enterDown,
  fade,
  iconSize,
  leaveDown,
  leaveUp,
  LocateIcon,
  mapPalette,
  OfflineIcon,
  radius,
  ResetViewIcon,
  SearchIcon,
  ShieldIcon,
  SkeletonMap,
  space,
  SyncIcon,
  TAB_BAR_OVERHANG,
  Text,
  useTabBarHeight,
} from '../../src/ui'

/* The Atlas: the play field. The map fills the screen and runs under the
   tab bar; over it float the quest card, the level indicator, the search,
   reset and locate controls and the tip, and from below rises the
   parchment sheet of the chosen cottage (entering a code is the tab bar's
   centre button). The screen owns the selection, the camera framing around
   the sheet and the celebration that follows a find; the map and the sheet
   report back through callbacks. */

/* The highest snap the camera follows: the half. The full one covers the
   map, so the half's framing stays and is right again when the sheet comes
   back down. */
const CAMERA_SNAP_MAX: SnapIndex = 1

export default function AtlasScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { cottages, rewards, status, stale, refresh, total, cottageBySlug } = useContent()
  const online = useOnline()
  const { state, foundSlugs, foundCount, lastFound } = useProgress()

  const map = useRef<AtlasMapHandle>(null)
  const sheet = useRef<CottageSheetHandle>(null)
  const [selected, setSelected] = useState<Cottage | null>(null)
  const selectedRef = useRef<Cottage | null>(null)
  const [initialSnap, setInitialSnap] = useState<SnapIndex>(1)
  const [justFoundSlug, setJustFoundSlug] = useState<string | null>(null)
  const [level, setLevel] = useState<MapLevel>('kraj')
  const [tipSeen, setTipSeen] = useState(false)
  const reality = useSharedValue(0)

  /* The tab bar floats over the map, so everything at the bottom edge (the
     chrome, the sheet, the attribution) sits above its height, which the
     bar reports once mounted. The sheet's snaps are fractions of the screen
     between the status bar and the bar; the screen is measured because the
     window height is not the screen's own on Android. */
  const bottomInset = useTabBarHeight()
  const [screenHeight, setScreenHeight] = useState(windowHeight)
  const sheetContainerHeight = Math.max(0, screenHeight - insets.top - bottomInset)

  const upcoming = useMemo(() => {
    const next = nextLevel(state, rewards.levels, total)
    return next ? { name: next.level.name, remaining: next.remaining } : null
  }, [state, rewards.levels, total])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  /* The camera keeps room for the sheet: the snap's height plus the bar
     under it plus a breath. Remembered so a snap to the same height is not
     sent twice. */
  const framedPadding = useRef(0)
  const paddingForSnap = useCallback(
    (index: number) => sheetHeightForIndex(Math.min(index, CAMERA_SNAP_MAX), sheetContainerHeight) + bottomInset + space.lg,
    [sheetContainerHeight, bottomInset],
  )

  /* Opens (or moves) the sheet on a cottage and frames the cottage above it. */
  const openAt = useCallback(
    (cottage: Cottage, index: SnapIndex, mode: FrameMode = 'ease') => {
      setTipSeen(true)
      if (selectedRef.current) {
        setSelected(cottage)
        sheet.current?.snapToIndex(index)
      } else {
        setInitialSnap(index)
        setSelected(cottage)
      }
      selectedRef.current = cottage
      const padding = paddingForSnap(index)
      framedPadding.current = padding
      map.current?.frameCottage(cottage, padding, mode)
    },
    [paddingForSnap],
  )

  const choose = useCallback(
    (cottage: Cottage) => {
      if (selectedRef.current) {
        setSelected(cottage)
        selectedRef.current = cottage
        map.current?.frameCottage(cottage, framedPadding.current || paddingForSnap(1))
        return
      }
      openAt(cottage, 1)
    },
    [openAt, paddingForSnap],
  )

  /* A reset closes the sheet and frames the whole land in one go, so the
     close must not ease the camera back on its own. */
  const skipRecentre = useRef(false)

  const onSheetClose = useCallback(() => {
    setSelected(null)
    selectedRef.current = null
    setJustFoundSlug(null)
    framedPadding.current = 0
    if (skipRecentre.current) {
      skipRecentre.current = false
      return
    }
    map.current?.recentre()
  }, [])

  const onSheetSnap = useCallback(
    (index: number) => {
      const padding = paddingForSnap(index)
      if (Math.abs(padding - framedPadding.current) < 4) return
      framedPadding.current = padding
      map.current?.setBottomPadding(padding)
    },
    [paddingForSnap],
  )

  const closeSheet = useCallback(() => {
    if (!selectedRef.current) return
    sheet.current?.close()
  }, [])

  const onMapPress = useCallback(() => closeSheet(), [closeSheet])

  /* Android back closes the sheet while one is open. */
  useFocusEffect(
    useCallback(() => {
      if (!selected) return
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        sheet.current?.close()
        return true
      })
      return () => subscription.remove()
    }, [selected]),
  )

  /* The level rung, kept in state only when it changes. */
  const levelRef = useRef<MapLevel>('kraj')
  const onLevelChange = useCallback((next: MapLevel) => {
    if (levelRef.current === next) return
    levelRef.current = next
    setLevel(next)
  }, [])

  /* The launch's first fix brings the camera to the seeker and the nearest
     cottage, unless a cottage is framed (a link, a find, a pin) or the map
     has been moved already, which the map itself keeps track of. A fix that
     lands before the map exists (the content still loading) waits for it. */
  const pendingArrival = useRef<LatLng | null>(null)
  const arrive = useCallback(
    (fix: LatLng) => {
      if (selectedRef.current) return
      map.current?.arriveAt(fix, nearestPlace(fix, cottages)?.place ?? null)
    },
    [cottages],
  )
  const onFirstFix = useCallback(
    (fix: LatLng) => {
      if (map.current) arrive(fix)
      else pendingArrival.current = fix
    },
    [arrive],
  )
  useEffect(() => {
    const waiting = pendingArrival.current
    if (!waiting || !map.current) return
    pendingArrival.current = null
    arrive(waiting)
  }, [cottages, arrive])
  const { position, locating, locateMe } = useLocate(map, { onFirstFix })

  /* No cottage in view: the beacon points to the nearest one, kept clear of
     the chrome above and below, whose heights are measured. */
  const [outOfSight, setOutOfSight] = useState<OutOfSight | null>(null)
  const [chrome, setChrome] = useState({ top: 0, bottom: 0 })
  const onTopChromeLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setChrome((current) => (current.top === height ? current : { ...current, top: height }))
  }, [])
  const onBottomChromeLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setChrome((current) => (current.bottom === height ? current : { ...current, bottom: height }))
  }, [])
  /* The toasts of the locate control float above this chrome. */
  const toast = useToast()
  useFocusEffect(
    useCallback(() => {
      toast.setBottomClearance(chrome.bottom)
      return () => toast.setBottomClearance(0)
    }, [toast, chrome.bottom]),
  )
  const goToNearest = useCallback(() => {
    if (outOfSight) openAt(outOfSight.cottage, 1, 'fly')
  }, [outOfSight, openAt])
  /* The screen reader hears of a new nearest cottage once, not on every
     settle of the view. */
  const voicedNearest = useRef<string | null>(null)
  useEffect(() => {
    if (!outOfSight || selected) {
      voicedNearest.current = null
      return
    }
    if (voicedNearest.current === outOfSight.cottage.slug) return
    voicedNearest.current = outOfSight.cottage.slug
    announce(t('mobile:atlas.nearestAria', { title: outOfSight.cottage.title, distance: formatDistance(outOfSight.distanceKm, i18n.resolvedLanguage ?? i18n.language, t) }))
  }, [outOfSight, selected, t, i18n.resolvedLanguage])

  const onFocusCottage = useCallback(
    (cottage: Cottage, reason: FocusReason) => {
      if (reason === 'found') {
        setJustFoundSlug(cottage.slug)
        openAt(cottage, 0)
        return
      }
      openAt(cottage, 1, map.current?.isInView(cottage) === false ? 'fly' : 'ease')
    },
    [openAt],
  )
  useAtlasFocus({ cottageBySlug, lastFound, onFocus: onFocusCottage })

  const resetView = useCallback(() => {
    if (selectedRef.current) {
      skipRecentre.current = true
      sheet.current?.close()
    }
    map.current?.resetView()
  }, [])

  const openSearch = useCallback(() => router.push({ pathname: '/cottages', params: { search: '1' } }), [router])

  const searchControls = useMemo(
    () => [{ key: 'search', label: t('map.searchLabel'), icon: <SearchIcon size={iconSize.md} color={mapPalette.chromeIcon} />, onPress: openSearch }],
    [t, openSearch],
  )
  const bottomControls = useMemo(
    () => [
      { key: 'reset', label: t('map.resetView'), icon: <ResetViewIcon size={iconSize.md} color={mapPalette.chromeIcon} />, onPress: resetView },
      { key: 'locate', label: t('map.locate'), icon: <LocateIcon size={iconSize.md} color={mapPalette.chromeIcon} />, onPress: () => void locateMe(), disabled: locating, busy: locating },
    ],
    [t, resetView, locateMe, locating],
  )

  /* Entrances are for changes, not for the first frame: the bottom row and
     the map only animate in when they return (after the sheet, after the
     skeleton). */
  const firstRender = useRef(true)
  useEffect(() => {
    firstRender.current = false
  }, [])
  const hadSkeleton = useRef(false)

  const noCache = cottages.length === 0
  if (noCache && status === 'loading') hadSkeleton.current = true

  let body
  if (noCache && status === 'loading') {
    body = (
      <View style={styles.fill}>
        <SkeletonMap />
        <View style={[styles.firstDownload, { bottom: bottomInset + TAB_BAR_OVERHANG + space.lg }]} accessibilityRole="progressbar" accessibilityLabel={t('mobile:atlas.firstDownloadTitle')}>
          <Text variant="heading" style={styles.chromeInk}>
            {t('mobile:atlas.firstDownloadTitle')}
          </Text>
          <Text variant="small" style={styles.chromeInk}>
            {t('mobile:atlas.firstDownloadBody')}
          </Text>
        </View>
      </View>
    )
  } else if (noCache && status === 'error') {
    body = (
      <View style={[styles.center, { paddingTop: insets.top }]} accessibilityRole="alert">
        <EmptyState
          icon={ShieldIcon}
          title={t('atlas.errorTitle')}
          body={online === false ? t('mobile:common.offlineNoData') : t('atlas.errorBody')}
          action={{ label: t('mobile:common.retry'), onPress: () => void refresh({ force: true }) }}
        />
      </View>
    )
  } else if (noCache) {
    body = (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <EmptyState icon={AtlasIcon} title={t('atlas.emptyTitle')} />
      </View>
    )
  } else {
    body = (
      <Animated.View key="map" entering={hadSkeleton.current ? fade(DURATIONS.base) : undefined} style={styles.fill} accessibilityLabel={t('map.interactiveAria')}>
        <AtlasMap
          ref={map}
          cottages={cottages}
          foundSlugs={foundSlugs}
          selectedSlug={selected?.slug ?? null}
          justFoundSlug={justFoundSlug}
          userPosition={position}
          bottomInset={bottomInset}
          onSelect={choose}
          onMapPress={onMapPress}
          onLevelChange={onLevelChange}
          onOutOfSight={setOutOfSight}
          reality={reality}
        />
        <MapVignette reality={reality} topInset={insets.top} bottomInset={bottomInset} />

        {outOfSight && !selected ? (
          <NearestBeacon
            target={outOfSight}
            exclude={{ top: insets.top + space.md + chrome.top, bottom: bottomInset + space.lg + chrome.bottom }}
            onPress={goToNearest}
          />
        ) : null}

        <View style={[styles.top, { top: insets.top + space.md }]} pointerEvents="box-none" onLayout={onTopChromeLayout}>
          <View style={styles.topRow} pointerEvents="box-none">
            <QuestCard found={foundCount} total={total} upcoming={upcoming} />
            <View style={styles.topRight} pointerEvents="box-none">
              <LevelCard label={t('map.levelLabel')} level={t(LEVEL_KEYS[level])} />
              <ControlBar controls={searchControls} />
            </View>
          </View>
          {online === false ? (
            <Animated.View key="offline" entering={enterDown()} exiting={leaveUp()} style={styles.pillRow}>
              <StatusPill icon={OfflineIcon} label={t('mobile:common.offlineShort')} />
            </Animated.View>
          ) : stale ? (
            <Animated.View key="stale" entering={enterDown()} exiting={leaveUp()} style={styles.pillRow}>
              <StatusPill icon={SyncIcon} label={t('mobile:common.stale')} onPress={() => void refresh({ force: true })} />
            </Animated.View>
          ) : null}
        </View>

        {selected ? null : (
          <Animated.View
            key="bottom"
            entering={firstRender.current ? undefined : enterDown()}
            exiting={leaveDown()}
            style={[styles.bottom, { bottom: bottomInset + space.lg }]}
            pointerEvents="box-none"
            onLayout={onBottomChromeLayout}
          >
            {tipSeen ? null : (
              <Animated.View exiting={leaveDown()} style={styles.tipRow}>
                <MapTip>{t('map.tip')}</MapTip>
              </Animated.View>
            )}
            <View style={styles.controls} pointerEvents="box-none">
              <ControlBar controls={bottomControls} />
            </View>
          </Animated.View>
        )}

        {selected ? (
          <CottageSheet
            ref={sheet}
            cottage={selected}
            found={foundSlugs.has(selected.slug)}
            initialIndex={initialSnap}
            topInset={insets.top}
            bottomInset={bottomInset}
            onSnap={onSheetSnap}
            onClose={onSheetClose}
          />
        ) : null}
      </Animated.View>
    )
  }

  return (
    <View style={styles.screen} onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}>
      {body}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mapPalette.frame,
  },
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.page,
  },
  top: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    gap: space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  topRight: {
    alignItems: 'flex-end',
    gap: space.sm,
  },
  pillRow: {
    alignItems: 'flex-end',
  },
  bottom: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    gap: space.sm,
  },
  tipRow: {
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
  },
  firstDownload: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    gap: space.xs,
    padding: space.lg,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.card,
    backgroundColor: mapPalette.chrome,
  },
  chromeInk: {
    color: mapPalette.chromeInk,
  },
})
