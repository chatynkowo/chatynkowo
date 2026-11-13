import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CONTACT_EMAIL, reportText } from '@chatynkowo/core'
import { collectDiagnostics, mailReport, shareReport, type AppDiagnosticsReport } from '../../lib/diagnostics'
import { useContent, useSession, useToast } from '../../providers'
import { Button, MailIcon, Screen, SettingsRow, SettingsSection, ShareIcon, Text, colors, iconSize, radius, space, useTabBarClearance } from '../../ui'

/* Reporting a problem (the route /profile/report, from the Profile list):
   the app makes the diagnostics report by itself when the screen opens
   (lib/diagnostics), and one button hands it over: a message to us with
   the report attached and the address and the subject filled in, so the
   seeker only writes what happened and sends. The share sheet is there
   for a phone with no mail set up and for a seeker who would rather use
   another app. Under the buttons: what the report holds, what it leaves
   out, and the report itself for anyone who wants to read it first. The
   app sends nothing on its own. */

export function ReportScreen() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const tabBarClearance = useTabBarClearance()
  const { session, profile, providers } = useSession()
  const { status, lookupStatus, total, stale } = useContent()
  const [report, setReport] = useState<AppDiagnosticsReport | null>(null)
  const [busy, setBusy] = useState<'mail' | 'share' | null>(null)
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

  const subject = t('mobile:report.mailSubject')

  async function send() {
    if (!report || busy) return
    setBusy('mail')
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
      setBusy(null)
    }
  }

  async function share() {
    if (!report || busy) return
    setBusy('share')
    try {
      await shareReport(report, subject)
    } catch (error) {
      console.warn('[report] share', error)
      toast.show({ tone: 'error', text: t('mobile:report.failed') })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen contentStyle={{ gap: space.xl, paddingBottom: space.xxl + tabBarClearance }}>
      <Text tone="soft">{t('mobile:report.lead')}</Text>
      <View style={styles.actions}>
        <Button
          variant="primary"
          block
          icon={<MailIcon size={iconSize.md} weight="fill" color={colors.accentInk} />}
          /* Not `busy` while the report is being made: on Android a button
             that starts out busy keeps saying so to a screen reader. */
          disabled={!report}
          busy={busy === 'mail'}
          onPress={() => void send()}
        >
          {report ? t('mobile:report.send') : t('mobile:report.preparing')}
        </Button>
        <Button block icon={<ShareIcon size={iconSize.md} color={colors.ink} />} disabled={!report} busy={busy === 'share'} onPress={() => void share()}>
          {t('mobile:report.share')}
        </Button>
        <Text variant="small" tone="faint" selectable>
          {t('mobile:report.sendFooter', { email: CONTACT_EMAIL })}
        </Text>
      </View>
      <SettingsSection title={t('mobile:report.holdsTitle')} footer={t('mobile:report.without')}>
        <SettingsRow label={t('mobile:report.holdsApp')} subtitle={t('mobile:report.holdsAppDetail')} />
        <SettingsRow label={t('mobile:report.holdsStorage')} subtitle={t('mobile:report.holdsStorageDetail')} />
        <SettingsRow label={t('mobile:report.holdsAccount')} subtitle={t('mobile:report.holdsAccountDetail')} />
        <SettingsRow label={t('mobile:report.holdsNetwork')} subtitle={t('mobile:report.holdsNetworkDetail')} />
      </SettingsSection>
      <SettingsSection>
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
  actions: {
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
