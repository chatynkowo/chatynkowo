import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { Button, FoundIcon, KeyIcon, MarkdownView, NavigateIcon, NotebookIcon, Sheet, Text, colors, iconSize, space } from '../../ui'

/* The panel that opens on a marker, the counterpart of the site's map panel:
   who lives here, the public "on site" instructions, "Navigate" (system
   maps) and "I have a code" (the Code tab). A found cottage offers its
   story instead of the clue. */

type CottageSheetProps = {
  cottage: Cottage | null
  found: boolean
  onClose: () => void
  onNavigate: (cottage: Cottage) => void
  onHaveCode: (cottage: Cottage) => void
  onOpenStory: (cottage: Cottage) => void
}

export function CottageSheet({ cottage, found, onClose, onNavigate, onHaveCode, onOpenStory }: CottageSheetProps) {
  const { t } = useTranslation()
  return (
    <Sheet
      visible={Boolean(cottage)}
      onClose={onClose}
      closeLabel={t('map.closePanel')}
      eyebrow={cottage ? `${t('map.residentPrefix')} ${cottage.occupant || t('map.defaultOccupant')}` : undefined}
      title={cottage?.title}
    >
      {cottage ? (
        <>
          {found ? (
            <View style={styles.notice}>
              <FoundIcon size={iconSize.md} weight="fill" color={colors.success} />
              <Text tone="success">{t('map.alreadyInTreasury')}</Text>
            </View>
          ) : (
            <Text tone="soft">{t('map.clue')}</Text>
          )}
          {cottage.arrivalMarkdown ? (
            <View style={styles.arrival}>
              <Text variant="eyebrow">{t('mobile:story.arrivalHeading')}</Text>
              <MarkdownView>{cottage.arrivalMarkdown}</MarkdownView>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button variant="primary" block icon={<NavigateIcon size={iconSize.md} color={colors.accentInk} />} onPress={() => onNavigate(cottage)}>
              {t('map.navigate')}
            </Button>
            {found ? (
              <Button block icon={<NotebookIcon size={iconSize.md} color={colors.ink} />} onPress={() => onOpenStory(cottage)}>
                {t('mobile:atlas.story')}
              </Button>
            ) : (
              <Button block icon={<KeyIcon size={iconSize.md} color={colors.ink} />} onPress={() => onHaveCode(cottage)}>
                {t('map.haveCode')}
              </Button>
            )}
          </View>
        </>
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  arrival: {
    gap: space.sm,
  },
  actions: {
    gap: space.sm,
    marginTop: space.sm,
  },
})
