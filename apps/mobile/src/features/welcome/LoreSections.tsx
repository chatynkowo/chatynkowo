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
import { Disc } from './Disc'
import { GuideTrail } from './GuideTrail'

/* The site's lore and guide sections as building blocks: the onboarding
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

/* The four questions the site answers in its cards (what the cottages are,
   who lives there, how to find one, what to do on arrival) as four rows:
   the glyph in a disc, the question and its answer, at full width so every
   answer is a line or two and the four read top-down in one column. On the
   onboarding page the rows spread over the height above the creed. */
export function LoreQuestions({ fill = false }: { fill?: boolean }) {
  const { t } = useTranslation()
  const questions: Array<{ Glyph: Icon; title: string; body: string }> = [
    { Glyph: CottageIcon, title: t('lore.cardWhatTitle'), body: t('lore.cardWhatBody') },
    { Glyph: ElfIcon, title: t('lore.cardWhoTitle'), body: t('lore.cardWhoBody') },
    { Glyph: AtlasIcon, title: t('lore.cardFindTitle'), body: t('lore.cardFindBody') },
    { Glyph: QrIcon, title: t('lore.cardArriveTitle'), body: t('lore.cardArriveBody') },
  ]
  return (
    <View style={[styles.rows, fill && styles.rowsFill]} accessibilityRole="list">
      {questions.map(({ Glyph, title, body }) => (
        <View key={title} style={styles.row} accessible>
          <Disc>
            <Glyph size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
          </Disc>
          <View style={styles.rowText}>
            <Text weight="bold">{title}</Text>
            <Text variant="small" tone="soft">
              {body}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

/* The creed as the one framed block: the hands-and-heart glyph beside the
   quote, the body under them. */
export function CreedCard() {
  const { t } = useTranslation()
  return (
    <View style={styles.creed}>
      <View style={styles.creedQuote}>
        <CreedIcon size={iconSize.hero} weight="duotone" color={colors.accentStrong} />
        <Text weight="italic" style={styles.creedQuoteText}>
          {t('lore.creedQuote')}
        </Text>
      </View>
      <Text tone="soft">{t('lore.creedBody')}</Text>
    </View>
  )
}

/* The guide's eyebrow with the notebook and its title. */
export function GuideHeading() {
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
    </View>
  )
}

/* The guide in full: the heading, the lead and the four steps as the trail,
   for the About screen. The onboarding shows the heading and the trail alone
   and lets the trail take the rest of its page. */
export function GuideSection() {
  const { t } = useTranslation()
  return (
    <View style={styles.section}>
      <GuideHeading />
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
  rows: {
    gap: space.lg,
  },
  /* Grows, never shrinks below the rows, so a large text size still scrolls
     the page instead of clipping the rows. */
  rowsFill: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
  },
  creed: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  creedQuote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  creedQuoteText: {
    flex: 1,
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
