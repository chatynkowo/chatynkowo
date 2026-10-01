import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react'
import { AccessibilityInfo, ActionSheetIOS, Platform, StyleSheet, View, findNodeHandle, type AccessibilityActionEvent } from 'react-native'
import BottomSheet, { BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { countryName, type Cottage } from '@chatynkowo/core'
import { haptic } from '../../lib/haptics'
import { openInMaps, type MapsApp } from '../../lib/navigate'
import { Button, CloseIcon, colors, FoundIcon, IconButton, iconSize, mapPalette, MarkdownView, NavigateIcon, NotebookIcon, PinIcon, radius, readable, space, SPRINGS, TAB_BAR_OVERHANG, Text } from '../../ui'

/* The parchment sheet that rises over the map when a cottage is chosen,
   the site's cottage panel on a phone: the country, the name, who lives
   there, the two ways onward, the clue (or the "already found" note) and
   the public "on site" instructions. It is a gesture sheet with three
   snaps (peek, half, and the whole screen below the status bar) that
   leaves the map pannable; the Atlas frames the cottage above it and
   follows its snaps with the camera padding. */

export type CottageSheetHandle = BottomSheet

/* The snaps as fractions of the sheet's container, the screen between the
   status bar and the tab bar. */
const SNAP_FRACTIONS = [0.32, 0.58, 1] as const
const SNAP_POINTS = SNAP_FRACTIONS.map((fraction) => `${Math.round(fraction * 100)}%`)

export type SnapIndex = 0 | 1 | 2

/* The height of a snap in points, for the camera padding. */
export function sheetHeightForIndex(index: number, containerHeight: number): number {
  const fraction = SNAP_FRACTIONS[Math.max(0, Math.min(SNAP_FRACTIONS.length - 1, index))] ?? SNAP_FRACTIONS[1]
  return Math.round(containerHeight * fraction)
}

/* VoiceOver moves to the title once the enter spring has settled. */
const FOCUS_DELAY_MS = 450

type CottageSheetProps = {
  cottage: Cottage
  found: boolean
  /* Where the sheet opens: peek after a find, half otherwise. */
  initialIndex: SnapIndex
  /* The status bar above the sheet's container and the tab bar under it. */
  topInset: number
  bottomInset: number
  /* The sheet settled on another snap (not fired for the opening one). */
  onSnap: (index: number) => void
  onClose: () => void
}

export const CottageSheet = forwardRef<CottageSheetHandle, CottageSheetProps>(function CottageSheet(
  { cottage, found, initialIndex, topInset, bottomInset, onSnap, onClose },
  ref,
) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const springs = useBottomSheetSpringConfigs(SPRINGS.settle)
  const lastIndex = useRef<number>(initialIndex)
  const titleRef = useRef<View>(null)

  const onChange = useCallback(
    (index: number) => {
      if (index === lastIndex.current) return
      lastIndex.current = index
      if (index < 0) return
      haptic('select')
      onSnap(index)
    },
    [onSnap],
  )

  /* Move the screen reader to the title once the sheet has come up. */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const node = titleRef.current ? findNodeHandle(titleRef.current) : null
        if (node) AccessibilityInfo.setAccessibilityFocus(node)
      } catch {
        // No accessibility bridge; nothing to focus.
      }
    }, FOCUS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [cottage.slug])

  /* The Apple Maps or Google Maps question on iOS, asked once and remembered
     by the navigate adapter. */
  const chooser = useCallback(
    (choices: MapsApp[]) =>
      new Promise<MapsApp | null>((resolve) => {
        if (Platform.OS !== 'ios') return resolve(choices[0] ?? null)
        const labels = choices.map((choice) => (choice === 'apple' ? t('mobile:navigate.appleMaps') : t('mobile:navigate.googleMaps')))
        ActionSheetIOS.showActionSheetWithOptions(
          { title: t('mobile:navigate.chooseApp'), options: [...labels, t('mobile:common.cancel')], cancelButtonIndex: labels.length },
          (index) => resolve(index < labels.length ? choices[index] ?? null : null),
        )
      }),
    [t],
  )

  const navigate = () => {
    haptic('light')
    void openInMaps(cottage, cottage.title, { chooser })
  }
  const haveCode = () => router.push({ pathname: '/code', params: { slug: cottage.slug } })
  const openStory = () => router.push({ pathname: '/story/[slug]', params: { slug: cottage.slug } })

  const close = useCallback(() => {
    if (typeof ref === 'object' && ref?.current) ref.current.close()
    else onClose()
  }, [ref, onClose])

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'escape') close()
  }

  const snapPoints = useMemo(() => SNAP_POINTS, [])

  return (
    <BottomSheet
      ref={ref}
      index={initialIndex}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={topInset}
      bottomInset={bottomInset}
      animationConfigs={springs}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      onChange={onChange}
      onClose={onClose}
      containerStyle={styles.container}
    >
      <View style={styles.body}>
        <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text variant="eyebrow" style={styles.country}>
              {countryName(cottage.country, i18n.resolvedLanguage ?? i18n.language)}
            </Text>
            <View
              ref={titleRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel={t('map.panelAria', { title: cottage.title })}
              accessibilityActions={[{ name: 'escape' }]}
              onAccessibilityAction={onAccessibilityAction}
            >
              <Text variant="title" style={styles.title}>
                {cottage.title}
              </Text>
            </View>
            <Text style={styles.resident}>
              {t('map.residentPrefix')}{' '}
              <Text weight="bold" style={styles.resident}>
                {cottage.occupant || t('map.defaultOccupant')}
              </Text>
            </Text>
            <View style={styles.actions}>
              <Button variant="primary" style={styles.action} icon={<NavigateIcon size={iconSize.md} weight="fill" color={colors.accentInk} />} onPress={navigate}>
                {t('map.navigate')}
              </Button>
              {found ? (
                <Button surface="parchment" style={styles.action} icon={<NotebookIcon size={iconSize.md} color={mapPalette.panelButtonInk} />} onPress={openStory}>
                  {t('mobile:atlas.story')}
                </Button>
              ) : (
                <Button surface="parchment" style={styles.action} icon={<PinIcon size={iconSize.md} color={mapPalette.panelButtonInk} />} onPress={haveCode}>
                  {t('map.haveCode')}
                </Button>
              )}
            </View>
          </View>
          <View style={[styles.note, found ? styles.noteFound : styles.noteClue]}>
            {found ? <FoundIcon size={iconSize.md} weight="fill" color={mapPalette.clueFoundInk} /> : null}
            <Text variant="small" style={[styles.noteText, found ? styles.noteFoundText : styles.noteClueText]}>
              {found ? t('map.alreadyInTreasury') : t('map.clue')}
            </Text>
          </View>
          {cottage.arrivalMarkdown ? <MarkdownView tone="parchment">{cottage.arrivalMarkdown}</MarkdownView> : null}
        </BottomSheetScrollView>
        <IconButton label={t('map.closePanel')} onPress={close} style={styles.close}>
          <CloseIcon size={iconSize.md} color={mapPalette.panelInk} />
        </IconButton>
      </View>
    </BottomSheet>
  )
})

const styles = StyleSheet.create({
  container: {
    zIndex: 2,
  },
  background: {
    backgroundColor: mapPalette.panel,
    borderTopWidth: 1,
    borderColor: mapPalette.panelBorder,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: mapPalette.panelHandle,
  },
  /* The scroll and the close button share the readable column. */
  body: {
    ...readable,
    flex: 1,
  },
  content: {
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    /* The tab bar's raised button pokes above the sheet's bottom edge. */
    paddingBottom: space.xl + TAB_BAR_OVERHANG,
  },
  header: {
    gap: space.sm,
  },
  close: {
    position: 'absolute',
    top: space.xs,
    right: space.lg,
    backgroundColor: mapPalette.panelClose,
    borderColor: mapPalette.panelCloseBorder,
  },
  country: {
    color: mapPalette.panelMuted,
  },
  title: {
    color: mapPalette.panelInk,
    paddingRight: 48,
  },
  resident: {
    color: mapPalette.panelText,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  action: {
    flex: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderRadius: radius.control,
    marginVertical: space.xs,
  },
  noteFound: {
    borderColor: mapPalette.clueFoundBorder,
    backgroundColor: mapPalette.clueFound,
  },
  noteClue: {
    borderColor: mapPalette.clueBorder,
    backgroundColor: mapPalette.clue,
  },
  noteText: {
    flex: 1,
  },
  noteFoundText: {
    color: mapPalette.clueFoundInk,
  },
  noteClueText: {
    color: mapPalette.clueInk,
  },
})
