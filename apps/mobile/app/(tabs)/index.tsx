import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { nextLevel, type Cottage } from '@chatynkowo/core'
import { AtlasMap, LEVEL_KEYS, type AtlasMapHandle, type FrameMode, type MapLevel } from '../../src/features/atlas/AtlasMap'
import { CottageSheet, sheetHeightForIndex, type CottageSheetHandle, type SnapIndex } from '../../src/features/atlas/CottageSheet'
import { ControlBar, HaveCodeFab, LevelCard, MapTip, StatusPill } from '../../src/features/atlas/MapChrome'
import { MapVignette } from '../../src/features/atlas/MapVignette'
import { QuestCard } from '../../src/features/atlas/QuestCard'
import { useAtlasFocus, type FocusReason } from '../../src/features/atlas/useAtlasFocus'
import { useLocate } from '../../src/features/atlas/useLocate'
import { haptic } from '../../src/lib/haptics'
import { useContent, useOnline, useProgress } from '../../src/providers'
import {
  AtlasIcon,
  DURATIONS,
  EmptyState,
  LocateIcon,
  OfflineIcon,
  ResetViewIcon,
  SearchIcon,
  ShieldIcon,
  SkeletonMap,
  SyncIcon,
  Text,
  colors,
  enterDown,
  fade,
  iconSize,
  leaveDown,
  leaveUp,
  mapPalette,
  radius,
  space,
} from '../../src/ui'

/* The Atlas: the play field. The map fills the screen; over it float the
   quest card, the level indicator, the search, reset and locate controls,
   the tip and the gold "I have a code" pill, and from below rises the
   parchment sheet of the chosen cottage. The screen owns the selection,
   the camera framing around the sheet and the celebration that follows a
   find; the map and the sheet report back through callbacks. */

export default function AtlasScreen() {
  const { t } = useTranslation()
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

  /* The tab bar overlays the map on iOS and the Atlas opts out of the
     Android safe-area wrapper, so the bottom inset is the safe area's. The
     sheet's snaps are fractions of the screen above that inset; the screen
     is measured because on Android the bar takes real height. */
  const bottomInset = insets.bottom
  const [screenHeight, setScreenHeight] = useState(windowHeight)
  const sheetContainerHeight = Math.max(0, screenHeight - bottomInset)

  const upcoming = useMemo(() => {
    const next = nextLevel(state, rewards.levels, total)
    return next ? { name: next.level.name, remaining: next.remaining } : null
  }, [state, rewards.levels, total])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  /* The camera keeps room for the sheet: its height plus the inset under
     it plus a breath. Remembered so a snap to the same height is not sent
     twice. */
  const framedPadding = useRef(0)
  const paddingFor = useCallback((sheetHeight: number) => sheetHeight + bottomInset + space.lg, [bottomInset])

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
      const padding = paddingFor(sheetHeightForIndex(index, sheetContainerHeight))
      framedPadding.current = padding
      map.current?.frameCottage(cottage, padding, mode)
    },
    [paddingFor, sheetContainerHeight],
  )

  const choose = useCallback(
    (cottage: Cottage) => {
      haptic('medium')
      if (selectedRef.current) {
        setSelected(cottage)
        selectedRef.current = cottage
        map.current?.frameCottage(cottage, framedPadding.current || paddingFor(sheetHeightForIndex(1, sheetContainerHeight)))
        return
      }
      openAt(cottage, 1)
    },
    [openAt, paddingFor, sheetContainerHeight],
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
    (_index: number, height: number) => {
      const padding = paddingFor(height)
      if (Math.abs(padding - framedPadding.current) < 4) return
      framedPadding.current = padding
      map.current?.setBottomPadding(padding)
    },
    [paddingFor],
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

  /* The level rung: a select haptic on every change after the first report. */
  const levelRef = useRef<MapLevel>('kraj')
  const levelReported = useRef(false)
  const onLevelChange = useCallback((next: MapLevel) => {
    const changed = levelRef.current !== next
    if (changed && levelReported.current) haptic('select')
    levelReported.current = true
    if (!changed) return
    levelRef.current = next
    setLevel(next)
  }, [])

  const { position, locating, locateMe } = useLocate(map)

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

  const openSearch = useCallback(() => router.push('/search'), [router])
  const openCode = useCallback(() => {
    haptic('light')
    const slug = selectedRef.current?.slug
    router.push(slug ? { pathname: '/code', params: { slug } } : { pathname: '/code' })
  }, [router])
  const openScan = useCallback(() => {
    haptic('medium')
    router.push('/scan')
  }, [router])

  const onRingSettled = useCallback(() => haptic('light'), [])

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
        <View style={[styles.firstDownload, { bottom: bottomInset + space.lg }]} accessibilityRole="progressbar" accessibilityLabel={t('mobile:atlas.firstDownloadTitle')}>
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
          reality={reality}
        />
        <MapVignette reality={reality} topInset={insets.top} bottomInset={bottomInset} />

        <View style={[styles.top, { top: insets.top + space.md }]} pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            <QuestCard found={foundCount} total={total} upcoming={upcoming} onSettled={onRingSettled} />
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
          >
            {tipSeen ? null : (
              <Animated.View exiting={leaveDown()} style={styles.tipRow}>
                <MapTip>{t('map.tip')}</MapTip>
              </Animated.View>
            )}
            <View style={styles.bottomRow} pointerEvents="box-none">
              <ControlBar controls={bottomControls} />
              <View style={styles.spacer} pointerEvents="none" />
              <HaveCodeFab
                label={t('map.haveCode')}
                accessibilityLabel={t('mobile:atlas.haveCodeAria')}
                scanLabel={t('mobile:code.scan')}
                onPress={openCode}
                onLongPress={openScan}
              />
            </View>
          </Animated.View>
        )}

        {selected ? (
          <CottageSheet
            ref={sheet}
            cottage={selected}
            found={foundSlugs.has(selected.slug)}
            initialIndex={initialSnap}
            bottomInset={bottomInset}
            containerHeight={sheetContainerHeight}
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
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  spacer: {
    flex: 1,
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
