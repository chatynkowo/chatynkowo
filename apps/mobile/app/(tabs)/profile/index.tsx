import type { ReactElement } from 'react'
import { Linking, Platform, SectionList, StyleSheet } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SITE_ORIGIN, SOCIAL_LINKS } from '@chatynkowo/core'
import { AccountSection } from '../../../src/features/profile/AccountSection'
import { SupportCard } from '../../../src/features/support/SupportCard'
import { LANGUAGES, setLanguage, toLanguage } from '../../../src/i18n'
import { FacebookIcon, InstagramIcon, LoreIcon, NotebookIcon, SettingsRow, SettingsSection, colors, iconSize, readable, space, useTabBarClearance } from '../../../src/ui'

/* The Profile tab: grouped settings in the system idiom. The account block
   (who is signed in, the way to the account screen, or the sign-in), the
   support card (a coffee for the elf, right under the account so it is
   seen), the language, the lore (how to play, about), the legal pages in
   an in-app browser and the social profiles. Sign-out and account deletion
   live on the account screen. */

type Block = { key: string; node: ReactElement }

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const tabBarClearance = useTabBarClearance()
  const language = toLanguage(i18n.resolvedLanguage ?? i18n.language)

  const openLegal = (href: string) =>
    void WebBrowser.openBrowserAsync(`${SITE_ORIGIN}/${href}`, {
      toolbarColor: colors.pageRaised,
      controlsColor: colors.accentStrong,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    })

  const external = t('mobile:profile.openExternal')

  const blocks: Block[] = [
    { key: 'account', node: <AccountSection /> },
    { key: 'support', node: <SupportCard placement="profile" /> },
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
