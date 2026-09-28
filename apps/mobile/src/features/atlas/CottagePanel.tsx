import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { Button, CloseIcon, FoundIcon, IconButton, MarkdownView, NavigateIcon, NotebookIcon, PinIcon, Text, colors, iconSize, mapPalette, radius, space } from '../../ui'

/* The parchment panel that rises over the map when a cottage is chosen,
   the site's cottage panel on a phone: the country, the name,
   who lives there, the clue (or the "already found" note), the public
   "on site" instructions and the two ways onward. */

type CottagePanelProps = {
  cottage: Cottage
  found: boolean
  onClose: () => void
  onNavigate: (cottage: Cottage) => void
  onHaveCode: (cottage: Cottage) => void
  onOpenStory: (cottage: Cottage) => void
  onLayout: (event: LayoutChangeEvent) => void
}

function countryName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function CottagePanel({ cottage, found, onClose, onNavigate, onHaveCode, onOpenStory, onLayout }: CottagePanelProps) {
  const { t, i18n } = useTranslation()
  return (
    <View style={styles.panel} onLayout={onLayout} accessibilityLabel={t('map.panelAria', { title: cottage.title })}>
      <View style={styles.handle} />
      <IconButton label={t('map.closePanel')} onPress={onClose} style={styles.close}>
        <CloseIcon size={iconSize.md} color={mapPalette.panelInk} />
      </IconButton>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="eyebrow" style={styles.country}>
          {countryName(cottage.country, i18n.resolvedLanguage ?? 'pl')}
        </Text>
        <Text variant="title" style={styles.title} accessibilityRole="header">
          {cottage.title}
        </Text>
        <Text style={styles.resident}>
          {t('map.residentPrefix')}{' '}
          <Text weight="bold" style={styles.resident}>
            {cottage.occupant || t('map.defaultOccupant')}
          </Text>
        </Text>
        <View style={[styles.note, found ? styles.noteFound : styles.noteClue]}>
          {found ? <FoundIcon size={iconSize.md} weight="fill" color={mapPalette.clueFoundInk} /> : null}
          <Text variant="small" style={[styles.noteText, found ? styles.noteFoundText : styles.noteClueText]}>
            {found ? t('map.alreadyInTreasury') : t('map.clue')}
          </Text>
        </View>
        {cottage.arrivalMarkdown ? <MarkdownView tone="parchment">{cottage.arrivalMarkdown}</MarkdownView> : null}
        <View style={styles.actions}>
          <Button variant="primary" style={styles.action} icon={<NavigateIcon size={iconSize.md} weight="fill" color={colors.accentInk} />} onPress={() => onNavigate(cottage)}>
            {t('map.navigate')}
          </Button>
          {found ? (
            <Button surface="parchment" style={styles.action} icon={<NotebookIcon size={iconSize.md} color={mapPalette.panelButtonInk} />} onPress={() => onOpenStory(cottage)}>
              {t('mobile:atlas.story')}
            </Button>
          ) : (
            <Button surface="parchment" style={styles.action} icon={<PinIcon size={iconSize.md} color={mapPalette.panelButtonInk} />} onPress={() => onHaveCode(cottage)}>
              {t('map.haveCode')}
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
    borderTopWidth: 1,
    borderColor: mapPalette.panelBorder,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: mapPalette.panel,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    marginTop: 9,
    borderRadius: 3,
    backgroundColor: 'rgba(73, 52, 31, 0.28)',
  },
  close: {
    position: 'absolute',
    zIndex: 2,
    top: space.lg,
    right: space.lg,
    backgroundColor: mapPalette.panelClose,
    borderColor: mapPalette.panelCloseBorder,
  },
  content: {
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
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
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  action: {
    flex: 1,
  },
})
