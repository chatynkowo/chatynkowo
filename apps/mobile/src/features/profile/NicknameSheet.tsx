import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { DISPLAY_NAME_MAX_LENGTH, profilePatch } from '@chatynkowo/core'
import { providerAvatarUrl } from '../../lib/sync'
import { useCloseModal, useSession, useToast } from '../../providers'
import { Button, SheetRoute, Text, TextField, space, type TextFieldHandle } from '../../ui'

/* The nickname editor (the route /nickname): a sheet over the account
   screen or the Ranking with one field, focused once the sheet has
   settled so the keyboard finds a sheet to extend. Save sends the patch
   core computes (nothing when the name is unchanged, the current photo
   setting kept) and closes on the receipt; a refused save keeps the sheet
   and the typed name for the next try. A save that outlives the sheet
   (swiped away mid-await) leaves the receipt but closes nothing, as the
   code gate does. Opened signed out, or before the profile is read, the
   sheet closes at once. */

export function NicknameSheet() {
  const { t } = useTranslation()
  const account = useSession()
  const toast = useToast()
  const close = useCloseModal()
  const field = useRef<TextFieldHandle>(null)
  const [name, setName] = useState(account.profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const profile = account.profile
  const session = account.session
  useEffect(() => {
    if (!profile || !session) close()
  }, [profile, session, close])

  const patch = profile && session ? profilePatch(profile, { name, showAvatar: Boolean(profile.avatar_url), avatarUrl: providerAvatarUrl(session), fallbackName: t('profile.defaultName') }) : null

  async function save() {
    if (!patch || saving) return
    setSaving(true)
    try {
      await account.saveProfile(patch)
      toast.show({ tone: 'success', text: t('profile.saved') })
      if (mounted.current) close()
    } catch (error) {
      console.error('[account] profile', error)
      toast.show({ tone: 'error', text: t('profile.saveFailed') })
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <SheetRoute onPresented={() => field.current?.focus()}>
      <View style={styles.sheet}>
        <View style={styles.heading}>
          <Text variant="eyebrow">{t('mobile:profile.entryTitle')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:profile.nicknameTitle')}
          </Text>
        </View>
        <TextField
          ref={field}
          sheet
          label={t('profile.nickname')}
          hint={t('profile.nicknameHint')}
          value={name}
          onChangeText={setName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
        {!name.trim() ? (
          <Text variant="small" tone="faint">
            {t('profile.nicknameEmpty')}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button variant="primary" block busy={saving} disabled={!patch} onPress={() => void save()}>
            {t('profile.save')}
          </Button>
          <Button block onPress={close}>
            {t('mobile:common.cancel')}
          </Button>
        </View>
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingTop: space.sm,
    gap: space.lg,
  },
  heading: {
    gap: space.xs,
  },
  actions: {
    gap: space.sm,
  },
})
