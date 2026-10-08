import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { providerAvatarUrl, providerName, sessionEmail } from '../../lib/sync'
import { useProgress, useSession } from '../../providers'
import { Avatar, ProfileIcon, SettingsRow, SettingsSection, colors, iconSize, space } from '../../ui'
import { SignInButtons } from '../ranking/SignInButtons'

/* The account block of the Profile: signed in, one row that sums the
   account up (the picture or the initials, the nickname, the provider and
   the address) and opens the account screen, with the finds counter and
   the sync state as the footer; signed out, the sign-in buttons or, in a
   build with no sign-in, a note that the finds are safe on the device.
   The row is there as soon as there is a session, with the default name
   while the profile row is still unread (offline since the start): the
   way out of the account never depends on the backend. */

const AVATAR = 44

export function AccountSection() {
  const { t } = useTranslation()
  const router = useRouter()
  const account = useSession()
  const { foundCount, pendingCount, exchanging } = useProgress()

  const title = t('profile.account')

  if (!account.enabled) {
    return (
      <SettingsSection title={title} footer={t('profile.signInUnavailable')}>
        <SettingsRow icon={<ProfileIcon size={iconSize.md} color={colors.inkSoft} />} label={t('mobile:profile.signedOut')} />
      </SettingsSection>
    )
  }

  if (!account.session) {
    return (
      <SettingsSection title={title} footer={t('profile.signInLead')}>
        <View style={styles.padded}>
          <SignInButtons />
        </View>
      </SettingsSection>
    )
  }

  const footer = [
    t('profile.finds', { count: foundCount }),
    pendingCount > 0 ? t('mobile:common.pendingSync', { count: pendingCount }) : null,
    exchanging ? t('profile.exchanging') : null,
  ]
    .filter(Boolean)
    .join('\n')

  const session = account.session
  /* The nickname once the profile row is in; the default name until then. */
  const name = account.profile?.display_name || t('profile.defaultName')
  const email = sessionEmail(session)
  const signedInWith = t('profile.signedInWith', { provider: providerName(session) })

  return (
    <SettingsSection title={title} footer={footer}>
      <SettingsRow
        leading={<Avatar name={name} uri={providerAvatarUrl(session)} size={AVATAR} />}
        label={name}
        subtitle={email ? `${signedInWith} · ${email}` : signedInWith}
        trailing={account.profile ? 'chevron' : <ActivityIndicator color={colors.accentStrong} accessibilityLabel={t('profile.loading')} />}
        accessibilityHint={t('mobile:profile.openAccount')}
        onPress={() => router.push('/profile/account')}
      />
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  padded: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
})
