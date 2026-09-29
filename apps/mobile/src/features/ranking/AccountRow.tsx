import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useProgress, useSession } from '../../providers'
import { Button, CrossfadeText, ProfileIcon, SettingsRow, SettingsSection, SyncIcon, Text, colors, iconSize, radius, space } from '../../ui'
import { SignInButtons } from './SignInButtons'

/* The account block at the top of the Ranking: a one-line notice while
   sign-in is not offered in this build; the invitation and the sign-in
   buttons when signed out; the name, the seeker's place, the state of the
   exchange with the account and the way to the profile when signed in. */

type AccountRowProps = {
  /* The seeker's 1-based place on the board, or null when not listed. */
  place: number | null
  /* Called after a successful sign-in, to refresh the board. */
  onSignedIn: () => void
}

export function AccountRow({ place, onSignedIn }: AccountRowProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const account = useSession()
  const { pendingCount, exchanging } = useProgress()

  if (!account.enabled) {
    return <Text tone="soft">{t('mobile:ranking.signInUnavailable')}</Text>
  }

  const pending =
    pendingCount > 0 ? (
      <View style={styles.line}>
        <SyncIcon size={iconSize.sm} color={colors.inkSoft} />
        <CrossfadeText variant="small" tone="soft" style={styles.lineText} value={t('mobile:common.pendingSync', { count: pendingCount })} />
      </View>
    ) : null

  if (!account.session) {
    return (
      <View style={styles.block} accessibilityLiveRegion="polite">
        <SettingsSection>
          <SettingsRow
            icon={<ProfileIcon size={iconSize.lg} color={colors.accentStrong} />}
            label={t('mobile:ranking.signInRow')}
            trailing="chevron"
            onPress={() => router.navigate('/profile')}
          />
        </SettingsSection>
        <SignInButtons onSignedIn={onSignedIn} />
        {pending}
      </View>
    )
  }

  const name = account.profile?.display_name || t('ranking.defaultName')
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text>
        {t('ranking.signedInPrefix')}{' '}
        <Text weight="bold">{name}</Text>
      </Text>
      <CrossfadeText tone="soft" variant="small" value={place ? t('mobile:ranking.yourPlace', { place }) : t('mobile:ranking.notRanked')} />
      {exchanging ? (
        <View style={styles.line}>
          <ActivityIndicator size="small" color={colors.accentStrong} />
          <Text variant="small" tone="soft" style={styles.lineText}>
            {t('mobile:ranking.exchanging')}
          </Text>
        </View>
      ) : null}
      {pending}
      <Button onPress={() => router.navigate('/profile')} style={styles.edit}>
        {t('ranking.edit')}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    gap: space.md,
  },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  lineText: {
    flex: 1,
  },
  edit: {
    marginTop: space.xs,
  },
})
