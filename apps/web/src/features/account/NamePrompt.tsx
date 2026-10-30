import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DISPLAY_NAME_MAX_LENGTH, profilePatch } from '@chatynkowo/core'
import { isDefaultName, providerAvatarUrl } from '../../lib/sync'
import { useAccount } from '../../providers/AccountProvider'
import { Button, Modal, Notice } from '../../ui'
import './Account.css'

/* The profile page asks a seeker still under the default nickname for a
   name of their own, the twin of the app's sheet after a sign-in: Apple
   shares the name once, and only when the seeker lets it, so an account
   can arrive here as the default. A dialog with one field, opened as soon
   as the row is read; "Later" closes it for the rest of the visit (this
   tab), and the account card below keeps the same field for any time. */

const LATER_KEY = 'chatynkowo:name-prompt-later'

function laterFor(): string | null {
  try {
    return sessionStorage.getItem(LATER_KEY)
  } catch {
    return null
  }
}

export function NamePrompt() {
  const { t } = useTranslation()
  const account = useAccount()
  const { session, profile } = account
  const [later, setLater] = useState(laterFor)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  if (!account.ready || !session || !profile || !isDefaultName(profile.display_name) || later === profile.id) return null

  const patch = profilePatch(profile, { name, showAvatar: Boolean(profile.avatar_url), avatarUrl: providerAvatarUrl(session), fallbackName: t('profile.defaultName') })

  function putOff() {
    if (!profile) return
    try {
      sessionStorage.setItem(LATER_KEY, profile.id)
    } catch {
      // The dialog closes for this page only.
    }
    setLater(profile.id)
  }

  /* A saved name closes the dialog by itself: the row no longer carries
     the default. A refused save keeps the typed name for the next try. */
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!patch || saving) return
    setSaving(true)
    setFailed(false)
    try {
      await account.saveProfile(patch)
    } catch (reason) {
      console.error('[account] profile', reason)
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal className="account-confirm" labelledBy="name-prompt-title" closeLabel={t('profilePage.nameLater')} onClose={putOff} initialFocus={field}>
      <h2 id="name-prompt-title">{t('profilePage.nameTitle')}</h2>
      <p>{t('profilePage.nameLead')}</p>
      <form className="account-form" onSubmit={(event) => void save(event)}>
        <label className="account-field">
          <span>{t('profile.nickname')}</span>
          <input value={name} onChange={(event) => { setName(event.target.value); setFailed(false) }} maxLength={DISPLAY_NAME_MAX_LENGTH} autoComplete="nickname" ref={field} />
        </label>
        {failed && <Notice tone="error">{t('profile.saveFailed')}</Notice>}
        <div className="account-confirm__actions">
          <Button variant="primary" type="submit" disabled={!patch || saving} aria-busy={saving}>
            {t('profilePage.save')}
          </Button>
          <Button onClick={putOff}>{t('profilePage.nameLater')}</Button>
        </div>
      </form>
    </Modal>
  )
}
