import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccount } from '../../providers/AccountProvider'
import { Button, Modal, Notice, SignOutIcon, iconSize } from '../../ui'
import './Account.css'

/* The way out, confirmed in a dialog as in the app: the finds stay in the
   browser. A failure is a complaint under the button. */

export function SignOutSection() {
  const { t } = useTranslation()
  const account = useAccount()
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)

  async function signOut() {
    const outcome = await account.signOut()
    setConfirming(false)
    setFailed(outcome === 'failed')
  }

  return (
    <section className="profile-signout" aria-label={t('profile.signOut')}>
      <Button variant="subtle" onClick={() => { setFailed(false); setConfirming(true) }}>
        <SignOutIcon size={iconSize.md} aria-hidden /> {t('profile.signOut')}
      </Button>
      {failed && <Notice tone="error">{t('profile.signOutFailed')}</Notice>}
      {confirming && (
        <Modal className="profile-confirm" labelledBy="signout-title" closeLabel={t('profile.signOutCancel')} onClose={() => setConfirming(false)}>
          <h2 id="signout-title">{t('profile.signOutConfirm')}</h2>
          <p>{t('profile.signOutBody')}</p>
          <div className="profile-confirm__actions">
            <Button variant="primary" disabled={account.busy} aria-busy={account.busy} onClick={() => void signOut()}>
              {t('profile.signOut')}
            </Button>
            <Button onClick={() => setConfirming(false)}>{t('profile.signOutCancel')}</Button>
          </div>
        </Modal>
      )}
    </section>
  )
}
