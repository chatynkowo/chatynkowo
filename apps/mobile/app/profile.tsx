import { useEffect, useState } from 'react'
import { Linking, StyleSheet, Switch, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SITE_ORIGIN, SOCIAL_LINKS } from '@chatynkowo/core'
import { LANGUAGES, setLanguage, toLanguage } from '../src/i18n'
import { useProgress, useSession } from '../src/providers'
import {
  Button,
  CloseIcon,
  FacebookIcon,
  IconButton,
  InstagramIcon,
  LanguageIcon,
  LoreIcon,
  NotebookIcon,
  ScreenFrame,
  SignOutIcon,
  Text,
  TextField,
  colors,
  iconSize,
  radius,
  space,
} from '../src/ui'

/* Language choice and the "about" links for everyone; nickname, avatar and
   sign-out for a signed-in account. */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const account = useSession()
  const { foundCount } = useProgress()
  const [name, setName] = useState('')
  const [showAvatar, setShowAvatar] = useState(false)
  const [saved, setSaved] = useState(false)
  const language = toLanguage(i18n.resolvedLanguage ?? i18n.language)

  useEffect(() => {
    setName(account.profile?.display_name ?? '')
    setShowAvatar(Boolean(account.profile?.avatar_url))
  }, [account.profile])

  async function save() {
    const metadata = account.session?.user.user_metadata ?? {}
    const providerAvatar = String(metadata.avatar_url || metadata.picture || '') || null
    await account.saveProfile({
      display_name: name.trim() || account.profile?.display_name || t('ranking.defaultName'),
      avatar_url: showAvatar ? providerAvatar : null,
    })
    setSaved(true)
  }

  const open = (url: string) => void Linking.openURL(url)

  return (
    <ScreenFrame
      eyebrow={account.session ? t('mobile:profile.title') : undefined}
      title={account.session ? t('ranking.profileTitle') : t('mobile:profile.title')}
      lead={account.session ? t('ranking.profileLede') : undefined}
      edges={['top', 'left', 'right', 'bottom']}
      action={
        <IconButton label={t('ranking.profileClose')} onPress={() => router.back()}>
          <CloseIcon size={iconSize.lg} color={colors.ink} />
        </IconButton>
      }
    >
      <View style={styles.section}>
        <View style={styles.sectionTitle}>
          <LanguageIcon size={iconSize.md} color={colors.accentStrong} />
          <Text weight="bold">{t('mobile:common.language')}</Text>
        </View>
        <View style={styles.row} accessibilityLabel={t('header.languageAria')}>
          {LANGUAGES.map((entry) => (
            <Button
              key={entry.code}
              variant={entry.code === language ? 'primary' : 'subtle'}
              accessibilityState={{ selected: entry.code === language }}
              onPress={() => void setLanguage(entry.code)}
            >
              {entry.nativeName}
            </Button>
          ))}
        </View>
      </View>

      {account.session ? (
        <View style={styles.section}>
          <TextField label={t('ranking.nickname')} value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('ranking.showAvatar')}</Text>
            <Switch value={showAvatar} onValueChange={setShowAvatar} trackColor={{ true: colors.accent, false: colors.surfaceSoft }} thumbColor={colors.ink} />
          </View>
          <Text variant="small" tone="faint">
            {t('mobile:profile.finds', { count: foundCount })}
          </Text>
          <Button variant="primary" block busy={account.busy} onPress={() => void save()}>
            {t('ranking.save')}
          </Button>
          {saved ? (
            <Text tone="success" align="center">
              {t('mobile:profile.saved')}
            </Text>
          ) : null}
          <Button variant="subtle" block icon={<SignOutIcon size={iconSize.md} color={colors.inkSoft} />} onPress={() => void account.signOut().then(() => router.back())}>
            {t('ranking.signOut')}
          </Button>
        </View>
      ) : account.enabled ? (
        <Text tone="soft">{t('mobile:profile.signedOut')}</Text>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionTitle}>
          <LoreIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
          <Text weight="bold">{t('lore.eyebrow')}</Text>
        </View>
        <Button block icon={<NotebookIcon size={iconSize.md} color={colors.ink} />} onPress={() => router.push('/welcome')}>
          {t('mobile:profile.about')}
        </Button>
        <Text variant="small" tone="faint">
          {t('footer.docsAria')}
        </Text>
        <View style={styles.row}>
          <Button variant="subtle" onPress={() => open(`${SITE_ORIGIN}/${t('footer.termsHref')}`)}>
            {t('footer.terms')}
          </Button>
          <Button variant="subtle" onPress={() => open(`${SITE_ORIGIN}/${t('footer.privacyHref')}`)}>
            {t('footer.privacy')}
          </Button>
        </View>
        <Text variant="small" tone="faint">
          {t('footer.socialAria')}
        </Text>
        <View style={styles.row}>
          <Button variant="subtle" icon={<InstagramIcon size={iconSize.md} color={colors.inkSoft} />} onPress={() => open(SOCIAL_LINKS.instagram)}>
            Instagram
          </Button>
          <Button variant="subtle" icon={<FacebookIcon size={iconSize.md} color={colors.inkSoft} />} onPress={() => open(SOCIAL_LINKS.facebook)}>
            Facebook
          </Button>
        </View>
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  switchLabel: {
    flex: 1,
  },
})
