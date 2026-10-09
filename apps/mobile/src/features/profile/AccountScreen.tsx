import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Switch, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { profilePatch } from '@chatynkowo/core'
import { providerAvatarUrl, providerName, sessionEmail } from '../../lib/sync'
import { useProgress, useSession, useToast } from '../../providers'
import { Avatar, Screen, SettingsRow, SettingsSection, ShieldIcon, SignOutIcon, Text, WarningIcon, colors, iconSize, space, useTabBarClearance } from '../../ui'
import { SignInButtons } from '../ranking/SignInButtons'

/* The account screen (the route /profile/account): who the seeker is
   signed in as (the provider's picture or the initials, the nickname, the
   provider and the address), the leaderboard entry (the nickname, edited
   in its own sheet, and whether the account photo shows on the board,
   saved the moment the switch moves), the finds held by the account with
   the way to the Ranking, the preferences (the consent to ads, which the
   Profile list offers as well so a signed-out seeker reaches it), a
   confirmed sign-out and, apart from the rest, the confirmed deletion of
   the account. Both ways out pop the screen
   (only while it is still the focused one: a seeker who left during the
   call is not moved again); the Profile beneath then shows the sign-in.
   The identity, the sign-out and the deletion need only the session, so
   they are there even while the profile row cannot be read (offline since
   the start); the leaderboard entry waits for the row. A stale link that
   lands here signed out shows the sign-in instead of a blank screen.
   While the account is busy the header shows a spinner and the rows
   ignore presses. */

const PORTRAIT = 96

export function AccountScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const navigation = useNavigation()
  const account = useSession()
  const { foundCount, pendingCount, exchanging } = useProgress()
  const toast = useToast()
  const tabBarClearance = useTabBarClearance()
  /* Seeded from the row so the switch does not animate on from off at the
     first frame; the effect follows later changes (a save, a re-read). */
  const [showAvatar, setShowAvatar] = useState(Boolean(account.profile?.avatar_url))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setShowAvatar(Boolean(account.profile?.avatar_url))
  }, [account.profile])

  /* Back to the Profile list, unless the seeker already went elsewhere
     while the account call was running. */
  const leave = () => {
    if (navigation.isFocused()) router.back()
  }

  const contentStyle = { paddingBottom: space.xxl + tabBarClearance }

  if (!account.enabled) {
    return (
      <Screen contentStyle={contentStyle}>
        <Text tone="soft">{t('profile.signInUnavailable')}</Text>
      </Screen>
    )
  }

  if (!account.session) {
    return (
      <Screen contentStyle={contentStyle}>
        <Text tone="soft">{t('profile.signInLead')}</Text>
        <SignInButtons />
      </Screen>
    )
  }

  const session = account.session
  const profile = account.profile
  /* The nickname once the row is in; the default name until then. */
  const name = profile?.display_name || t('profile.defaultName')

  const provider = providerName(session)
  const email = sessionEmail(session)
  const picture = providerAvatarUrl(session)
  const busy = account.busy || saving

  /* A press while the account is busy (a save, a sign-out, a deletion in
     flight) is ignored rather than queued. */
  const unlessBusy = (action: () => void) => () => {
    if (!busy) action()
  }

  /* The switch is the only field saved here; the nickname has its sheet.
     A refused save puts the switch back. */
  async function toggleAvatar(next: boolean) {
    if (!profile || busy) return
    const patch = profilePatch(profile, { name: profile.display_name, showAvatar: next, avatarUrl: picture, fallbackName: t('profile.defaultName') })
    if (!patch) return
    setShowAvatar(next)
    setSaving(true)
    try {
      await account.saveProfile(patch)
      toast.show({ tone: 'success', text: t('profile.saved') })
    } catch (error) {
      console.error('[account] profile', error)
      setShowAvatar(Boolean(profile.avatar_url))
      toast.show({ tone: 'error', text: t('profile.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const confirmSignOut = () =>
    Alert.alert(t('profile.signOutConfirm'), t('profile.signOutBody'), [
      { text: t('profile.signOutCancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: () =>
          void account.signOut().then((outcome) => {
            if (outcome === 'ok') leave()
            else toast.show({ tone: 'error', text: t('profile.signOutFailed') })
          }),
      },
    ])

  const confirmDelete = () =>
    Alert.alert(t('profile.deleteAccountConfirm'), t('profile.deleteAccountBody'), [
      { text: t('profile.deleteAccountCancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: () =>
          void account.deleteAccount().then((outcome) => {
            if (outcome === 'ok') {
              toast.show({ tone: 'success', text: t('profile.deleteAccountDone') })
              leave()
            } else {
              toast.show({ tone: 'error', text: t('profile.deleteAccountFailed') })
            }
          }),
      },
    ])

  const avatarFooter = !picture ? t('mobile:profile.avatarNone', { provider }) : showAvatar ? t('mobile:profile.avatarOn', { provider }) : t('mobile:profile.avatarOff')

  const findsFooter =
    [pendingCount > 0 ? t('mobile:common.pendingSync', { count: pendingCount }) : null, exchanging ? t('profile.exchanging') : null].filter(Boolean).join('\n') || undefined

  return (
    <Screen contentStyle={[styles.content, contentStyle]}>
      <View style={styles.identity} accessible accessibilityRole="header" accessibilityLabel={[name, t('profile.signedInWith', { provider }), email].filter(Boolean).join(', ')}>
        <Avatar name={name} uri={picture} size={PORTRAIT} />
        <Text variant="heading" align="center" numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.identityLines}>
          <Text variant="small" tone="soft" align="center">
            {t('profile.signedInWith', { provider })}
          </Text>
          {email ? (
            <Text variant="small" tone="faint" align="center" numberOfLines={1} selectable={false}>
              {email}
            </Text>
          ) : null}
        </View>
        {/* The spinner keeps its room, so the sections below do not jump. */}
        <View style={styles.busy}>{busy ? <ActivityIndicator color={colors.accentStrong} accessibilityLabel={t('profile.loading')} /> : null}</View>
      </View>

      {profile ? (
        <SettingsSection title={t('mobile:profile.entryTitle')} footer={`${t('mobile:profile.entryFooter')}\n${avatarFooter}`}>
          <SettingsRow label={t('profile.nickname')} value={profile.display_name} trailing="chevron" onPress={unlessBusy(() => router.push('/nickname'))} />
          <SettingsRow
            label={t('mobile:profile.avatarRow')}
            trailing={
              <Switch
                value={showAvatar}
                disabled={!picture || busy}
                onValueChange={(next) => void toggleAvatar(next)}
                trackColor={{ true: colors.accent, false: colors.surfaceSoft }}
                thumbColor={colors.ink}
                accessibilityLabel={t('mobile:profile.avatarRow')}
              />
            }
          />
        </SettingsSection>
      ) : (
        <SettingsSection title={t('mobile:profile.entryTitle')} footer={t('profile.loading')}>
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accentStrong} accessibilityLabel={t('profile.loading')} />
          </View>
        </SettingsSection>
      )}

      <SettingsSection title={t('mobile:profile.findsTitle')} footer={findsFooter}>
        {/* What the account holds: the device's finds less those still queued. */}
        <SettingsRow label={t('mobile:profile.findsRow')} value={String(Math.max(0, foundCount - pendingCount))} />
        <SettingsRow label={t('mobile:profile.openRanking')} trailing="chevron" onPress={unlessBusy(() => router.navigate('/ranking'))} />
      </SettingsSection>

      <SettingsSection title={t('mobile:preferences.title')} footer={t('mobile:preferences.rowFooter')}>
        <SettingsRow icon={<ShieldIcon size={iconSize.md} color={colors.accentStrong} />} label={t('mobile:preferences.row')} trailing="chevron" onPress={unlessBusy(() => router.push('/profile/preferences'))} />
      </SettingsSection>

      <SettingsSection footer={t('mobile:profile.signOutFooter')}>
        <SettingsRow icon={<SignOutIcon size={iconSize.md} color={colors.accentStrong} />} label={t('profile.signOut')} onPress={unlessBusy(confirmSignOut)} />
      </SettingsSection>

      <SettingsSection title={t('mobile:profile.deleteTitle')} footer={t('profile.deleteAccountLead')}>
        <SettingsRow tone="danger" icon={<WarningIcon size={iconSize.md} color={colors.danger} />} label={t('profile.deleteAccount')} onPress={unlessBusy(confirmDelete)} />
      </SettingsSection>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: space.xl,
  },
  identity: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  identityLines: {
    alignItems: 'center',
    gap: space.xs,
  },
  busy: {
    height: iconSize.lg,
    justifyContent: 'center',
  },
  loading: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
})
