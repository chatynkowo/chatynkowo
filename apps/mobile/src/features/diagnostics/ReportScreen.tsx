import { useEffect, useState } from 'react'
import { Linking, Platform, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CONTACT_EMAIL, SITE_DIAGNOSTICS_PAGES, reportText } from '@chatynkowo/core'
import { collectDiagnostics, mailReport, shareReport, type AppDiagnosticsReport } from '../../lib/diagnostics'
import { useContent, useSession, useToast } from '../../providers'
import { Button, MailIcon, Screen, SettingsRow, SettingsSection, Text, colors, iconSize, radius, space, useTabBarClearance } from '../../ui'

/* Reporting a problem (the route /profile/report, from the Profile list),
   in as few words as it takes, because nobody reads a screen of
   explanations: one line, one button, and the rest for whoever looks.

   The app makes the diagnostics report by itself when the screen opens
   (lib/diagnostics) and the button hands it over: a message to us with
   the report attached and the address and the subject filled in, so the
   seeker only writes what happened and sends. A phone with no mail set up
   gets the share sheet instead, with a toast naming our address. The app
   sends nothing on its own.

   An app cannot read what a browser keeps for the site, so a seeker who
   uses the site as well sends its report too: two rows open the site's
   page for it at both addresses the site answers at (https and http,
   which a browser remembers apart). They open the system's browser, not
   an in-app one: only there is the site's storage the one the seeker has
   been using. The last row shows the report itself. */

export function ReportScreen() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const tabBarClearance = useTabBarClearance()
  const { session, profile, providers } = useSession()
  const { status, lookupStatus, total, stale } = useContent()
  const [report, setReport] = useState<AppDiagnosticsReport | null>(null)
  const [sending, setSending] = useState(false)
  const [shown, setShown] = useState(false)

  /* Made when the screen opens, and again when the account or the content
     settles under it; the session object changes on every token refresh,
     so the seeker and their row are what the report follows. */
  const userId = session?.user.id
  const profileId = profile?.id
  useEffect(() => {
    let current = true
    void collectDiagnostics({
      session,
      profile,
      offered: providers,
      language: i18n.language,
      content: { status, codes: lookupStatus, cottages: total, stale },
    }).then((collected) => {
      if (current) setReport(collected)
    })
    return () => {
      current = false
    }
  }, [userId, profileId, status, lookupStatus])

  async function send() {
    if (!report || sending) return
    const subject = t('mobile:report.mailSubject')
    setSending(true)
    try {
      const outcome = await mailReport(report, { subject, body: t('mobile:report.mailBody') })
      if (outcome === 'sent') toast.show({ tone: 'success', text: t('mobile:report.sent') })
      if (outcome === 'no-mail') {
        toast.show({ tone: 'info', text: t('mobile:report.noMail', { email: CONTACT_EMAIL }), durationMs: 7000 })
        await shareReport(report, subject)
      }
    } catch (error) {
      console.warn('[report] send', error)
      toast.show({ tone: 'error', text: t('mobile:report.failed') })
    } finally {
      setSending(false)
    }
  }

  async function openSite(address: string) {
    try {
      await Linking.openURL(address)
    } catch (error) {
      console.warn('[report] site', error)
      toast.show({ tone: 'error', text: t('mobile:report.siteFailed', { address }), durationMs: 7000 })
    }
  }

  return (
    <Screen contentStyle={{ gap: space.xl, paddingBottom: space.xxl + tabBarClearance }}>
      <View style={styles.send}>
        <Text tone="soft">{t('mobile:report.lead')}</Text>
        <Button
          variant="primary"
          block
          icon={<MailIcon size={iconSize.md} weight="fill" color={colors.accentInk} />}
          /* Not `busy` while the report is being made: on Android a button
             that starts out busy keeps saying so to a screen reader. */
          disabled={!report}
          busy={sending}
          onPress={() => void send()}
        >
          {report ? t('mobile:report.send') : t('mobile:report.preparing')}
        </Button>
      </View>
      <SettingsSection title={t('mobile:report.siteTitle')}>
        {(['https', 'http'] as const).map((scheme) => (
          <SettingsRow
            key={scheme}
            label={t('mobile:report.siteRow', { scheme })}
            trailing="external"
            accessibilityHint={t('mobile:profile.openExternal')}
            onPress={() => void openSite(SITE_DIAGNOSTICS_PAGES[scheme])}
          />
        ))}
      </SettingsSection>
      <SettingsSection footer={t('mobile:report.without')}>
        <SettingsRow label={shown ? t('mobile:report.hide') : t('mobile:report.show')} disabled={!report} onPress={() => setShown((open) => !open)} />
      </SettingsSection>
      {shown && report ? (
        <View style={styles.report}>
          <Text variant="small" tone="soft" selectable style={styles.reportText}>
            {reportText(report)}
          </Text>
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  send: {
    gap: space.md,
  },
  report: {
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  /* The report is data: a fixed-width face keeps its indentation readable. */
  reportText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 16,
  },
})
