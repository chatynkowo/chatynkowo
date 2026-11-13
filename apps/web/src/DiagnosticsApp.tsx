import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTACT_EMAIL, reportFileName, reportText } from '@chatynkowo/core'
import { SitePage } from './components/SitePage'
import './features/account/Account.css'
import { collectDiagnostics, type DiagnosticsReport } from './lib/diagnostics'
import { useAccount } from './providers/AccountProvider'
import { Button, CopyIcon, DownloadIcon, LinkButton, MailIcon, Notice, ReportIcon, SpinnerIcon, iconSize } from './ui'

/* The page a seeker reports a problem from, reached from the profile:
   how to report it, the diagnostics report to send along (a file to
   download, a text to copy, and the message to put it in), what the
   report holds and what it leaves out. The report is made here, in the
   browser, and goes nowhere by itself (lib/diagnostics). The page only
   looks: it runs no exchange with the account, so what it describes is
   what the seeker had. */

export function DiagnosticsApp() {
  const { t } = useTranslation()

  return (
    <SitePage page="diagnostics" mainClassName="diagnostics-main">
      <section className="diagnostics-intro" aria-labelledby="diagnostics-title">
        <p className="eyebrow">
          <ReportIcon size={iconSize.sm} weight="fill" aria-hidden /> {t('diagnosticsPage.eyebrow')}
        </p>
        <h1 id="diagnostics-title">{t('diagnosticsPage.title')}</h1>
        <p className="diagnostics-intro__lede">{t('diagnosticsPage.lede')}</p>
      </section>
      <section className="diagnostics-section" aria-labelledby="diagnostics-how-title">
        <h2 id="diagnostics-how-title">{t('diagnosticsPage.howTitle')}</h2>
        <ol>
          <li>{t('diagnosticsPage.howReport')}</li>
          <li>{t('diagnosticsPage.howWrite', { email: CONTACT_EMAIL })}</li>
          <li>{t('diagnosticsPage.howAttach')}</li>
        </ol>
      </section>
      <ReportCard />
      <section className="diagnostics-section" aria-labelledby="diagnostics-holds-title">
        <h2 id="diagnostics-holds-title">{t('diagnosticsPage.holdsTitle')}</h2>
        <ul>
          <li>{t('diagnosticsPage.holdsBrowser')}</li>
          <li>{t('diagnosticsPage.holdsAccount')}</li>
          <li>{t('diagnosticsPage.holdsDevice')}</li>
          <li>{t('diagnosticsPage.holdsSite')}</li>
        </ul>
      </section>
      <section className="diagnostics-section" aria-labelledby="diagnostics-without-title">
        <h2 id="diagnostics-without-title">{t('diagnosticsPage.withoutTitle')}</h2>
        <p>{t('diagnosticsPage.withoutBody')}</p>
      </section>
    </SitePage>
  )
}

/* How long the report waits for the account to settle. This page is for
   the day something is broken, so a backend that does not answer must
   not hold the report back: it is made without it, and made again if
   the account's row does arrive. */
const ACCOUNT_WAIT_MS = 3000

type Receipt = 'copied' | 'copyFailed' | null

/* The report itself, wearing the account card's look: a line while it is
   being made, then the ways to take it (the file, the clipboard, the
   message to us) and the report to read before sending. */
function ReportCard() {
  const { t, i18n } = useTranslation()
  const { session, profile, ready } = useAccount()
  const [report, setReport] = useState<DiagnosticsReport | null>(null)
  const [waited, setWaited] = useState(false)
  const [receipt, setReceipt] = useState<Receipt>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), ACCOUNT_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const settled = ready || waited
  useEffect(() => {
    if (!settled) return
    let current = true
    void collectDiagnostics({ session, profile, ready, language: i18n.language }).then((collected) => {
      if (current) setReport(collected)
    })
    return () => {
      current = false
    }
    // The session object changes on every token refresh; the seeker and their row are what the report follows.
  }, [settled, session?.user.id, profile?.id])

  const text = useMemo(() => (report ? reportText(report) : ''), [report])

  /* The file behind the download link, replaced with every new report. */
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [text])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setReceipt('copied')
    } catch {
      setReceipt('copyFailed')
    }
  }

  const message = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('diagnosticsPage.mailSubject'))}&body=${encodeURIComponent(t('diagnosticsPage.mailBody'))}`

  return (
    <section className="account-card" aria-labelledby="diagnostics-report-title">
      <h2 id="diagnostics-report-title" className="account-card__title">{t('diagnosticsPage.reportTitle')}</h2>
      {report && fileUrl ? (
        <>
          <p className="account-lead">{t('diagnosticsPage.ready')}</p>
          <div className="diagnostics-actions">
            <LinkButton variant="primary" href={fileUrl} download={reportFileName(report)}>
              <DownloadIcon size={iconSize.md} aria-hidden /> {t('diagnosticsPage.download')}
            </LinkButton>
            <Button onClick={() => void copy()}>
              <CopyIcon size={iconSize.md} aria-hidden /> {t('diagnosticsPage.copy')}
            </Button>
            <LinkButton href={message}>
              <MailIcon size={iconSize.md} aria-hidden /> {t('diagnosticsPage.write')}
            </LinkButton>
          </div>
        </>
      ) : (
        <p className="account-status" role="status">
          <SpinnerIcon size={iconSize.md} aria-hidden /> {t('diagnosticsPage.preparing')}
        </p>
      )}
      <Notice live tone={receipt === 'copied' ? 'success' : receipt === 'copyFailed' ? 'error' : undefined}>
        {receipt === 'copied' && t('diagnosticsPage.copied')}
        {receipt === 'copyFailed' && t('diagnosticsPage.copyFailed')}
      </Notice>
      {report && (
        <details className="diagnostics-preview">
          <summary>{t('diagnosticsPage.preview')}</summary>
          <pre tabIndex={0} aria-label={t('diagnosticsPage.previewAria')}>{text}</pre>
        </details>
      )}
    </section>
  )
}
