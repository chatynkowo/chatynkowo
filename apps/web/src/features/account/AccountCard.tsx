import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DISPLAY_NAME_MAX_LENGTH, profilePatch } from '@chatynkowo/core'
import { localFinds, providerAvatarUrl } from '../../lib/sync'
import { useAccount, type AccountExchange } from '../../providers/AccountProvider'
import { Avatar, Button, Notice, SpinnerIcon, iconSize } from '../../ui'
import { SignInPanel } from './SignInPanel'
import './Account.css'

/* The account block of the profile page, the twin of the app's
   AccountSection: signed out, the way in; signed in, who the seeker is,
   the leaderboard entry they edit (the nickname, the account's picture
   when the provider shares one) with a receipt or a complaint after the
   save, and the finds the account holds with the state of the exchange. */

const RECEIPT_MS = 2500

/* The card's heading, which the page focuses after a sign-out. */
export const ACCOUNT_TITLE_ID = 'account-title'

type Receipt = 'saved' | 'failed' | null
const RECEIPT_TONE = { saved: 'success', failed: 'error' } as const

export function AccountCard({ exchange }: { exchange: AccountExchange }) {
  const { t } = useTranslation()
  const account = useAccount()
  const { session, profile } = account
  const [name, setName] = useState('')
  const [showAvatar, setShowAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<Receipt>(null)

  useEffect(() => {
    setName(profile?.display_name ?? '')
    setShowAvatar(Boolean(profile?.avatar_url))
  }, [profile])

  useEffect(() => {
    if (receipt !== 'saved') return
    const timer = window.setTimeout(() => setReceipt(null), RECEIPT_MS)
    return () => window.clearTimeout(timer)
  }, [receipt])

  /* The finds this browser holds, complete once the exchange settled. */
  const finds = useMemo(() => Object.keys(localFinds()).length, [exchange.settled])

  const avatarUrl = session ? providerAvatarUrl(session) : null
  /* What a save would send; null when nothing changed (the rule is in core,
     shared with the app). */
  const patch = profile ? profilePatch(profile, { name, showAvatar, avatarUrl, fallbackName: t('profile.defaultName') }) : null

  /* A refused save keeps the typed name for the next try and puts the
     checkbox back. */
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!patch || !profile || saving) return
    setSaving(true)
    setReceipt(null)
    try {
      await account.saveProfile(patch)
      setReceipt('saved')
    } catch (reason) {
      console.error('[account] profile', reason)
      setShowAvatar(Boolean(profile.avatar_url))
      setReceipt('failed')
    } finally {
      setSaving(false)
    }
  }

  const title = (
    <h2 id={ACCOUNT_TITLE_ID} className="account-card__title" tabIndex={-1}>
      {t('profile.account')}
    </h2>
  )

  if (!session) {
    return (
      <section className="account-card" aria-labelledby={ACCOUNT_TITLE_ID}>
        {title}
        <SignInPanel />
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="account-card" aria-labelledby={ACCOUNT_TITLE_ID}>
        {title}
        {account.ready ? (
          <Notice tone="error">{t('profilePage.loadFailed')}</Notice>
        ) : (
          <p className="account-status" role="status">
            <SpinnerIcon size={iconSize.md} aria-hidden /> {t('profile.loading')}
          </p>
        )}
      </section>
    )
  }

  const displayName = profile.display_name || t('profile.defaultName')
  return (
    <section className="account-card" aria-labelledby={ACCOUNT_TITLE_ID}>
      {title}
      <p className="account-card__who">
        <Avatar name={displayName} src={profile.avatar_url} />
        <span>
          {t('profile.signedInPrefix')} <strong>{displayName}</strong>
        </span>
      </p>
      <form className="account-form" onSubmit={(event) => void save(event)}>
        <div className="account-card__entry">
          <h3>{t('profilePage.entryTitle')}</h3>
          <p className="account-note">{t('profilePage.publicNote')}</p>
        </div>
        <label className="account-field">
          <span>{t('profile.nickname')}</span>
          <input value={name} onChange={(event) => { setName(event.target.value); setReceipt(null) }} maxLength={DISPLAY_NAME_MAX_LENGTH} autoComplete="nickname" />
        </label>
        {avatarUrl && (
          <label className="account-check">
            <input type="checkbox" checked={showAvatar} onChange={(event) => { setShowAvatar(event.target.checked); setReceipt(null) }} />
            <span>{t('profile.showAvatar')}</span>
          </label>
        )}
        <div className="account-form__actions">
          <Button variant="primary" type="submit" disabled={!patch || saving || account.busy} aria-busy={saving || account.busy}>
            {t('profilePage.save')}
          </Button>
          <Notice live tone={receipt ? RECEIPT_TONE[receipt] : undefined}>
            {receipt === 'saved' && t('profile.saved')}
            {receipt === 'failed' && t('profile.saveFailed')}
          </Notice>
        </div>
      </form>
      <p className="account-card__footer" role="status" aria-live="polite">
        {t('profile.finds', { count: finds })}
        {exchange.exchanging && (
          <span className="account-status">
            <SpinnerIcon size={iconSize.sm} aria-hidden /> {t('profile.exchanging')}
          </span>
        )}
      </p>
    </section>
  )
}
