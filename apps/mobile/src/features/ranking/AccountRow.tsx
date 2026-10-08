import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useProgress, useSession } from '../../providers'
import { Avatar, Button, CrossfadeText, ProfileIcon, SettingsRow, SettingsSection, SyncIcon, Text, colors, iconSize, radius, space } from '../../ui'
import { SignInButtons } from './SignInButtons'

/* The account block at the top of the Ranking: a one-line notice while
   sign-in is not offered in this build; the invitation and the sign-in
   buttons when signed out; signed in, the entry as the board shows it
   (the picture or the initials, the nickname), the seeker's place, the
   state of the exchange with the account, and two ways on: the nickname
   sheet and the account screen. */

const AVATAR = 40

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
    return <Text tone="soft">{t('profile.signInUnavailable')}</Text>
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
            label={t('ranking.signIn')}
            trailing="chevron"
            onPress={() => router.navigate('/profile')}
          />
        </SettingsSection>
        <SignInButtons onSignedIn={onSignedIn} />
        {pending}
      </View>
    )
  }

  const name = account.profile?.display_name || t('profile.defaultName')
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.entry}>
        <Avatar name={name} uri={account.profile?.avatar_url ?? null} size={AVATAR} />
        <View style={styles.entryText}>
          <Text weight="bold" numberOfLines={1}>
            {name}
          </Text>
          <CrossfadeText tone="soft" variant="small" value={place ? t('ranking.yourPlace', { place }) : t('ranking.notRanked')} />
        </View>
      </View>
      {exchanging ? (
        <View style={styles.line}>
          <ActivityIndicator size="small" color={colors.accentStrong} />
          <Text variant="small" tone="soft" style={styles.lineText}>
            {t('profile.exchanging')}
          </Text>
        </View>
      ) : null}
      {pending}
      <View style={styles.actions}>
        {/* The sheet needs the profile row; until it is read the button waits. */}
        <Button disabled={!account.profile} onPress={() => router.push('/nickname')}>
          {t('mobile:profile.changeNickname')}
        </Button>
        <Button variant="subtle" onPress={() => router.navigate('/profile/account', { withAnchor: true })}>
          {t('mobile:profile.accountTitle')}
        </Button>
      </View>
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
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  entryText: {
    flex: 1,
    gap: space.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.xs,
  },
})
