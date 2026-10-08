import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccount } from '../../providers/AccountProvider'
import { Button, Modal, Notice } from '../../ui'
import './Account.css'

/* The deletion of the account, confirmed in a dialog as the sign-out is:
   what goes and what stays, then the danger button. The outcome goes to
   the parent through `onDeleted` (the page decides what the seeker sees
   next); a failure is a complaint under the button, with the session
   left in place for another try. */

export function DeleteAccountSection({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useTranslation()
  const account = useAccount()
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)

  async function remove() {
    const outcome = await account.deleteAccount()
    setConfirming(false)
    setFailed(outcome === 'failed')
    if (outcome === 'ok') onDeleted()
  }

  return (
    <section className="account-delete" aria-label={t('profile.deleteAccount')}>
      <p className="account-lead">{t('profile.deleteAccountLead')}</p>
      <Button variant="danger" onClick={() => { setFailed(false); setConfirming(true) }}>
        {t('profile.deleteAccount')}
      </Button>
      {failed && <Notice tone="error">{t('profile.deleteAccountFailed')}</Notice>}
      {confirming && (
        <Modal className="account-confirm" labelledBy="delete-account-title" closeLabel={t('profile.deleteAccountCancel')} onClose={() => setConfirming(false)}>
          <h2 id="delete-account-title">{t('profile.deleteAccountConfirm')}</h2>
          <p>{t('profile.deleteAccountBody')}</p>
          <div className="account-confirm__actions">
            <Button variant="danger" disabled={account.busy} aria-busy={account.busy} onClick={() => void remove()}>
              {t('profile.deleteAccount')}
            </Button>
            <Button onClick={() => setConfirming(false)}>{t('profile.deleteAccountCancel')}</Button>
          </div>
        </Modal>
      )}
    </section>
  )
}
