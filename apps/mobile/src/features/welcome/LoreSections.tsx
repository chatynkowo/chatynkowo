import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { contentUrl } from '../../lib/content'
import {
  AtlasIcon,
  ContentImage,
  CottageIcon,
  CreedIcon,
  ElfIcon,
  LoreIcon,
  NotebookIcon,
  QrIcon,
  ShieldIcon,
  Text,
  TrailIcon,
  colors,
  iconSize,
  radius,
  space,
  type Icon,
} from '../../ui'
import { GuideTrail } from './GuideTrail'

/* The site's lore and guide sections as six building blocks: the onboarding
   pager spreads them over four pages, the profile's About screen stacks
   them in one scroll. Copy is the same as on the site; only the composition
   differs per screen. */

/* Eyebrow with the moon, the display title and the two intro paragraphs. */
export function LoreIntro() {
  const { t } = useTranslation()
  return (
    <View style={styles.section}>
      <View style={styles.eyebrowRow}>
        <LoreIcon size={iconSize.sm} weight="fill" color={colors.accentStrong} />
        <Text variant="eyebrow">{t('lore.eyebrow')}</Text>
      </View>
      <Text variant="display" accessibilityRole="header">
        {t('lore.title')}
      </Text>
      <Text tone="soft">{t('lore.intro1')}</Text>
      <Text tone="soft">{t('lore.intro2')}</Text>
    </View>
  )
}

/* The creed: the hands-and-heart hero, the quote in italics, the body. */
export function CreedCard() {
  const { t } = useTranslation()
  return (
    <View style={styles.creed}>
      <CreedIcon size={iconSize.hero} weight="duotone" color={colors.accentStrong} />
      <Text weight="italic">{t('lore.creedQuote')}</Text>
      <Text tone="soft">{t('lore.creedBody')}</Text>
    </View>
  )
}

/* The four cards: what the cottages are, who lives there, how to find one,
   what to do on arrival. A compact two by two grid, so the four fit one
   onboarding page. */
export function LoreCards() {
  const { t } = useTranslation()
  const cards: Array<{ Glyph: Icon; title: string; body: string }> = [
    { Glyph: CottageIcon, title: t('lore.cardWhatTitle'), body: t('lore.cardWhatBody') },
    { Glyph: ElfIcon, title: t('lore.cardWhoTitle'), body: t('lore.cardWhoBody') },
    { Glyph: AtlasIcon, title: t('lore.cardFindTitle'), body: t('lore.cardFindBody') },
    { Glyph: QrIcon, title: t('lore.cardArriveTitle'), body: t('lore.cardArriveBody') },
  ]
  return (
    <View style={styles.cards} accessibilityRole="list">
      {cards.map(({ Glyph, title, body }) => (
        <View key={title} style={styles.card}>
          <Glyph size={iconSize.xl} weight="duotone" color={colors.accentStrong} />
          <Text weight="bold">{title}</Text>
          <Text variant="small" tone="soft">
            {body}
          </Text>
        </View>
      ))}
    </View>
  )
}

/* The guide: eyebrow with the notebook, title, lead and the four steps as
   footprints along a trail. */
export function GuideSection() {
  const { t } = useTranslation()
  return (
    <View style={styles.section}>
      <View style={styles.eyebrowRow}>
        <NotebookIcon size={iconSize.sm} weight="fill" color={colors.accentStrong} />
        <Text variant="eyebrow">{t('guide.eyebrow')}</Text>
      </View>
      <Text variant="title" accessibilityRole="header">
        {t('guide.title')}
      </Text>
      <Text tone="soft">{t('guide.lead')}</Text>
      <GuideTrail />
    </View>
  )
}

/* The trail photo in 16:10 and the quote under it. */
export function TrailPhoto() {
  const { t } = useTranslation()
  return (
    <View style={styles.section}>
      <ContentImage
        uri={contentUrl('assets/img/chatynkowo-trail.webp')}
        aspectRatio={16 / 10}
        radius={radius.card}
        accessibilityLabel={t('guide.photoAlt')}
        style={styles.photo}
      />
      <Text weight="italic" align="center" tone="soft">
        {t('guide.quote')}
      </Text>
    </View>
  )
}

/* The two notes for the road: the trail note and the safety note. */
export function ExpeditionNotes() {
  const { t } = useTranslation()
  return (
    <View style={styles.notes} accessibilityLabel={t('quest.notesAria')}>
      <View style={styles.note}>
        <TrailIcon size={iconSize.md} color={colors.accentStrong} />
        <Text variant="small" tone="soft" style={styles.noteText}>
          <Text variant="small" weight="bold">
            {t('quest.note1Title')}.{' '}
          </Text>
          {t('quest.note1Body')}
        </Text>
      </View>
      <View style={styles.note}>
        <ShieldIcon size={iconSize.md} weight="duotone" color={colors.accentStrong} />
        <Text variant="small" tone="soft" style={styles.noteText}>
          <Text variant="small" weight="bold">
            {t('quest.note2Title')}.{' '}
          </Text>
          {t('quest.note2Body')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  creed: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  photo: {
    width: '100%',
  },
  notes: {
    gap: space.sm,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  noteText: {
    flex: 1,
  },
})
