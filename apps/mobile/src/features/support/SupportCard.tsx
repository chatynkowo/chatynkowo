import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Button, CoffeeIcon, Text, colors, iconSize, radius, space } from '../../ui'
import { useSupportLedger } from './useSupportLedger'

/* The invitation to support Chatynkowo, placed where a seeker has just
   been given something: the end of a tale, the foot of the Kronika, the
   profile. It only opens the support sheet (/support), where the coffee
   and the ad live; nothing is bought here. The ledger decides what the
   card says: before any support it invites, in the words of its
   placement; once a coffee or an ad has been given it thanks instead and
   keeps a quieter way back to the sheet, so a payer is never asked twice.

   Each placement wears the card differently:
   - story: compact, the closing line of a tale rather than a second
     section of the modal: the cup stands in for the eyebrow beside the
     heading, the lead is small and the note is left to the sheet, which
     repeats it under its buttons.
   - kronika: a section of the tab in its own right under the grid, with
     the eyebrow and the note, because the reader is looking at rewards
     and must not take a coffee for a way to earn one.
   - profile: the same full card in the account's list, where it
     replaces a plain settings row: the eyebrow names the section and the
     note says what the sheet says, before the sheet is opened. */

export type SupportPlacement = 'story' | 'kronika' | 'profile'

/* The invitation's words per placement (the story's heading sits beside
   the cup, the others under the eyebrow). */
const INVITATION: Record<SupportPlacement, { title: string; lead: string }> = {
  story: { title: 'mobile:support.storyTitle', lead: 'mobile:support.storyLead' },
  kronika: { title: 'mobile:support.kronikaTitle', lead: 'mobile:support.kronikaLead' },
  profile: { title: 'mobile:support.profileTitle', lead: 'mobile:support.profileLead' },
}

export function SupportCard({ placement }: { placement: SupportPlacement }) {
  const { t } = useTranslation()
  const router = useRouter()
  const ledger = useSupportLedger()
  const openSheet = () => router.push('/support')
  const supported = ledger.coffees + ledger.ads > 0
  const compact = placement === 'story'
  const words = INVITATION[placement]

  if (supported) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <CoffeeIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
          <Text variant="heading" accessibilityRole="header" style={styles.titleText}>
            {t('mobile:support.thanksTitle')}
          </Text>
        </View>
        <Text variant={compact ? 'small' : 'body'} tone="soft">
          {t('mobile:support.thanksLead')}
        </Text>
        <Button variant="subtle" block icon={<CoffeeIcon size={iconSize.md} color={colors.accentStrong} />} onPress={openSheet}>
          {t('mobile:support.openSheet')}
        </Button>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      {compact ? (
        <View style={styles.titleRow}>
          <CoffeeIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
          <Text variant="heading" accessibilityRole="header" style={styles.titleText}>
            {t(words.title)}
          </Text>
        </View>
      ) : (
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:support.eyebrow')}</Text>
          <Text variant="heading" accessibilityRole="header">
            {t(words.title)}
          </Text>
        </View>
      )}
      <Text variant={compact ? 'small' : 'body'} tone="soft">
        {t(words.lead)}
      </Text>
      <Button variant="primary" block icon={<CoffeeIcon size={iconSize.md} weight="fill" color={colors.accentInk} />} onPress={openSheet}>
        {t('mobile:support.action')}
      </Button>
      {compact ? null : (
        <Text variant="small" tone="faint">
          {t('mobile:support.note')}
        </Text>
      )}
    </View>
  )
}

/* The same card as the sheet's own (SupportSheet.tsx), so the invitation
   and what it opens read as one. */
const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  head: {
    gap: space.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  titleText: {
    flex: 1,
  },
})
