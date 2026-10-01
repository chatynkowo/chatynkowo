import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { DISPLAY_NAME_MAX_LENGTH } from '@chatynkowo/core'
import { providerAvatarUrl } from '../../lib/sync'
import { useProgress, useSession, useToast } from '../../providers'
import { ProfileIcon, SettingsRow, SettingsSection, TextField, colors, iconSize, space } from '../../ui'
import { SignInButtons } from '../ranking/SignInButtons'

/* The account block of the Profile: signed in, the nickname and the avatar
   toggle saving implicitly (when the field is left, on toggle) with a toast
   as the receipt or the complaint, and the finds counter with the sync
   state as the footer; signed out, the sign-in buttons or, in a build with
   no sign-in, a note that the finds are safe on the device. */

export function AccountSection() {
  const { t } = useTranslation()
  const account = useSession()
  const { foundCount, pendingCount, exchanging } = useProgress()
  const toast = useToast()
  const [name, setName] = useState('')
  const [showAvatar, setShowAvatar] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(account.profile?.display_name ?? '')
    setShowAvatar(Boolean(account.profile?.avatar_url))
  }, [account.profile])

  /* An empty nickname keeps the current one or falls back to the default;
     the avatar is the provider's picture or nothing. Nothing is sent when
     nothing changed, and nothing while a save is in flight. A refused save
     keeps the typed name in the field for the next try and puts the switch
     back. */
  async function save(nextName: string, nextAvatar: boolean) {
    const profile = account.profile
    const session = account.session
    if (!profile || !session || saving) return
    const displayName = nextName.trim() || profile.display_name || t('ranking.defaultName')
    if (displayName === profile.display_name && nextAvatar === Boolean(profile.avatar_url)) {
      setName(displayName)
      return
    }
    setSaving(true)
    try {
      await account.saveProfile({ display_name: displayName, avatar_url: nextAvatar ? providerAvatarUrl(session) : null })
      toast.show({ tone: 'success', text: t('mobile:profile.saved') })
    } catch (error) {
      console.error('[account] profile', error)
      setShowAvatar(Boolean(profile.avatar_url))
      toast.show({ tone: 'error', text: t('mobile:profile.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const title = t('mobile:profile.account')

  if (!account.enabled) {
    return (
      <SettingsSection title={title} footer={t('mobile:ranking.signInUnavailable')}>
        <SettingsRow icon={<ProfileIcon size={iconSize.md} color={colors.inkSoft} />} label={t('mobile:profile.signedOut')} />
      </SettingsSection>
    )
  }

  if (!account.session) {
    return (
      <SettingsSection title={title} footer={t('mobile:ranking.signInLead')}>
        <View style={styles.padded}>
          <SignInButtons />
        </View>
      </SettingsSection>
    )
  }

  /* Signed in, the row not read yet (or not readable right now): nothing to
     edit until it arrives with the next reconnect. */
  if (!account.profile) {
    return (
      <SettingsSection title={title}>
        <View style={styles.padded}>
          <ActivityIndicator color={colors.accentStrong} accessibilityLabel={t('mobile:ranking.exchanging')} />
        </View>
      </SettingsSection>
    )
  }

  const footer = [
    t('mobile:profile.finds', { count: foundCount }),
    pendingCount > 0 ? t('mobile:common.pendingSync', { count: pendingCount }) : null,
    exchanging ? t('mobile:ranking.exchanging') : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <SettingsSection title={title} footer={footer}>
      <View style={[styles.padded, styles.nameRow]}>
        <View style={styles.field}>
          <TextField
            label={t('ranking.nickname')}
            value={name}
            onChangeText={setName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            autoCapitalize="words"
            returnKeyType="done"
            onBlur={() => void save(name, showAvatar)}
          />
        </View>
        {saving || account.busy ? <ActivityIndicator color={colors.accentStrong} style={styles.spinner} /> : null}
      </View>
      <SettingsRow
        label={t('ranking.showAvatar')}
        trailing={
          <Switch
            value={showAvatar}
            onValueChange={(next) => {
              setShowAvatar(next)
              void save(name, next)
            }}
            trackColor={{ true: colors.accent, false: colors.surfaceSoft }}
            thumbColor={colors.ink}
            accessibilityLabel={t('ranking.showAvatar')}
          />
        }
      />
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  padded: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
  },
  field: {
    flex: 1,
  },
  spinner: {
    marginBottom: space.md,
  },
})
