import type { ReactElement } from 'react'
import { Alert, Linking, Platform, SectionList, StyleSheet } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SITE_ORIGIN, SOCIAL_LINKS } from '@chatynkowo/core'
import { AccountSection } from '../../../src/features/profile/AccountSection'
import { LANGUAGES, setLanguage, toLanguage } from '../../../src/i18n'
import { useSession, useToast } from '../../../src/providers'
import { CoffeeIcon, FacebookIcon, InstagramIcon, LoreIcon, NotebookIcon, SettingsRow, SettingsSection, SignOutIcon, colors, iconSize, readable, space, useTabBarClearance } from '../../../src/ui'

/* The Profile tab: grouped settings in the system idiom. The account block
   (nickname, avatar, sign-in), the language, the lore (how to play, about),
   the way to support Chatynkowo (the support sheet), the legal pages in an
   in-app browser, the social profiles and, for a signed-in account, a
   confirmed sign-out. */

type Block = { key: string; node: ReactElement }

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const account = useSession()
  const toast = useToast()
  const tabBarClearance = useTabBarClearance()
  const language = toLanguage(i18n.resolvedLanguage ?? i18n.language)

  const openLegal = (href: string) =>
    void WebBrowser.openBrowserAsync(`${SITE_ORIGIN}/${href}`, {
      toolbarColor: colors.pageRaised,
      controlsColor: colors.accentStrong,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    })

  const confirmSignOut = () =>
    Alert.alert(t('profile.signOutConfirm'), t('profile.signOutBody'), [
      { text: t('profile.signOutCancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: () =>
          void account.signOut().then((outcome) => {
            if (outcome === 'failed') toast.show({ tone: 'error', text: t('profile.signOutFailed') })
          }),
      },
    ])

  const external = t('mobile:profile.openExternal')

  const blocks: Block[] = [
    { key: 'account', node: <AccountSection /> },
    {
      key: 'language',
      node: (
        <SettingsSection title={t('mobile:common.language')}>
          {LANGUAGES.map((entry) => (
            <SettingsRow
              key={entry.code}
              label={entry.nativeName}
              trailing={entry.code === language ? 'check' : undefined}
              onPress={() => void setLanguage(entry.code)}
            />
          ))}
        </SettingsSection>
      ),
    },
    {
      key: 'lore',
      node: (
        <SettingsSection title={t('lore.eyebrow')}>
          <SettingsRow
            icon={<NotebookIcon size={iconSize.md} color={colors.accentStrong} />}
            label={t('mobile:profile.howToPlay')}
            trailing="chevron"
            onPress={() => router.push('/profile/guide')}
          />
          <SettingsRow
            icon={<LoreIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />}
            label={t('nav.about')}
            trailing="chevron"
            onPress={() => router.push('/profile/about')}
          />
        </SettingsSection>
      ),
    },
    {
      key: 'support',
      node: (
        <SettingsSection title={t('mobile:support.eyebrow')} footer={t('mobile:support.profileFooter')}>
          <SettingsRow icon={<CoffeeIcon size={iconSize.md} color={colors.accentStrong} />} label={t('mobile:support.profileRow')} trailing="chevron" onPress={() => router.push('/support')} />
        </SettingsSection>
      ),
    },
    {
      key: 'legal',
      node: (
        <SettingsSection title={t('footer.docsAria')}>
          <SettingsRow label={t('footer.terms')} trailing="external" accessibilityHint={external} onPress={() => openLegal(t('footer.termsHref'))} />
          <SettingsRow label={t('footer.privacy')} trailing="external" accessibilityHint={external} onPress={() => openLegal(t('footer.privacyHref'))} />
        </SettingsSection>
      ),
    },
    {
      key: 'social',
      node: (
        <SettingsSection title={t('footer.socialAria')}>
          <SettingsRow
            icon={<InstagramIcon size={iconSize.md} color={colors.inkSoft} />}
            label="Instagram"
            trailing="external"
            accessibilityHint={external}
            onPress={() => void Linking.openURL(SOCIAL_LINKS.instagram)}
          />
          <SettingsRow
            icon={<FacebookIcon size={iconSize.md} color={colors.inkSoft} />}
            label="Facebook"
            trailing="external"
            accessibilityHint={external}
            onPress={() => void Linking.openURL(SOCIAL_LINKS.facebook)}
          />
        </SettingsSection>
      ),
    },
  ]

  if (account.session) {
    blocks.push({
      key: 'signOut',
      node: (
        <SettingsSection>
          <SettingsRow tone="danger" icon={<SignOutIcon size={iconSize.md} color={colors.danger} />} label={t('profile.signOut')} onPress={confirmSignOut} />
        </SettingsSection>
      ),
    })
  }

  return (
    <SectionList
      sections={blocks.map((block) => ({ key: block.key, data: [block] }))}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => item.node}
      style={styles.list}
      /* The list runs under the floating tab bar; its last block stays clear of it. */
      contentContainerStyle={[styles.content, readable, { paddingBottom: tabBarClearance + space.xxl }]}
      contentInsetAdjustmentBehavior="automatic"
      scrollIndicatorInsets={{ bottom: tabBarClearance }}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
    />
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingTop: space.lg,
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
})
