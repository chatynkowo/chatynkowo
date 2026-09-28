import { Image, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import logo from '../assets/logo.png'
import { markWelcomeSeen } from '../src/features/welcome/WelcomeGate'
import { contentUrl } from '../src/lib/content'
import {
  AtlasIcon,
  Button,
  CloseIcon,
  CottageIcon,
  CreedIcon,
  ElfIcon,
  ForwardIcon,
  IconButton,
  KeyIcon,
  LoreIcon,
  NotebookIcon,
  QrIcon,
  ScreenFrame,
  ShieldIcon,
  Text,
  TrailIcon,
  colors,
  iconSize,
  radius,
  space,
  type Icon,
} from '../src/ui'

/* The start screen: what Chatynkowo is and how an expedition goes, the
   site's lore and guide sections in one scroll, ending in the two ways to
   begin. Shown once on the first launch, later from the profile. */
export default function WelcomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()

  function leave(then?: () => void) {
    void markWelcomeSeen()
    router.back()
    then?.()
  }

  const cards: Array<{ Glyph: Icon; title: string; body: string }> = [
    { Glyph: CottageIcon, title: t('lore.cardWhatTitle'), body: t('lore.cardWhatBody') },
    { Glyph: ElfIcon, title: t('lore.cardWhoTitle'), body: t('lore.cardWhoBody') },
    { Glyph: AtlasIcon, title: t('lore.cardFindTitle'), body: t('lore.cardFindBody') },
    { Glyph: QrIcon, title: t('lore.cardArriveTitle'), body: t('lore.cardArriveBody') },
  ]
  const steps = [1, 2, 3, 4].map((step) => ({ title: t(`guide.step${step}Title`), body: t(`guide.step${step}Body`) }))

  return (
    <ScreenFrame edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.frame}>
      <View style={styles.top}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
        <IconButton label={t('mobile:welcome.skip')} onPress={() => leave()}>
          <CloseIcon size={iconSize.lg} color={colors.ink} />
        </IconButton>
      </View>

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

      <View style={styles.creed}>
        <CreedIcon size={iconSize.hero} weight="duotone" color={colors.accentStrong} />
        <Text weight="italic">
          {t('lore.creedQuote')}
        </Text>
        <Text tone="soft">{t('lore.creedBody')}</Text>
      </View>

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

      <View style={styles.section}>
        <View style={styles.eyebrowRow}>
          <NotebookIcon size={iconSize.sm} weight="fill" color={colors.accentStrong} />
          <Text variant="eyebrow">{t('guide.eyebrow')}</Text>
        </View>
        <Text variant="title" accessibilityRole="header">
          {t('guide.title')}
        </Text>
        <Text tone="soft">{t('guide.lead')}</Text>
        <View style={styles.steps} accessibilityRole="list">
          {steps.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <Text variant="title" tone="accent" style={styles.stepNumber}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <View style={styles.stepText}>
                <Text weight="bold">{step.title}</Text>
                <Text variant="small" tone="soft">
                  {step.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Image
          source={{ uri: contentUrl('assets/img/chatynkowo-trail.webp') }}
          accessibilityLabel={t('guide.photoAlt')}
          accessibilityIgnoresInvertColors
          style={styles.photo}
          resizeMode="cover"
        />
        <Text weight="italic" align="center" tone="soft">
          {t('guide.quote')}
        </Text>
      </View>

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

      <View style={styles.actions}>
        <Button variant="primary" block iconAfter={<ForwardIcon size={iconSize.md} color={colors.accentInk} />} onPress={() => leave()}>
          {t('lore.openAtlas')}
        </Button>
        <Button block icon={<KeyIcon size={iconSize.md} color={colors.ink} />} onPress={() => leave(() => router.push('/code'))}>
          {t('nav.enterCode')}
        </Button>
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  frame: {
    gap: space.xl,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  logo: {
    width: 150,
    height: 120,
  },
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
    gap: space.md,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  steps: {
    gap: space.md,
  },
  step: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
  },
  stepNumber: {
    minWidth: 40,
  },
  stepText: {
    flex: 1,
    gap: space.xs,
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
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
  actions: {
    gap: space.sm,
  },
})
