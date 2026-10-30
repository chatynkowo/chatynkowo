import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signsInWithApple, takeDeletion } from '../../lib/sync'
import { useAccount, type DeletionOutcome } from '../../providers/AccountProvider'
import { Button, Modal, Notice } from '../../ui'
import './Account.css'

/* The deletion of the account, confirmed in a dialog as the sign-out is:
   what goes and what stays, then the danger button. The outcome goes to
   the parent through `onDeleted` (the page decides what the seeker sees
   next); a failure is a complaint under the button, with the session
   left in place for another try.

   An account that signs in with Apple is confirmed with Apple as well, as
   Apple asks (lib/sync deleteAccount): the dialog says so, the page leaves
   for Apple and, back on this page, the section finishes the deletion by
   itself, with a line saying it is under way. A return without Apple's
   confirmation, or as another account, deletes nothing and says why. */

type Complaint = 'failed' | 'apple' | null

export function DeleteAccountSection({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useTranslation()
  const account = useAccount()
  const [confirming, setConfirming] = useState(false)
  const [complaint, setComplaint] = useState<Complaint>(null)
  const [resuming, setResuming] = useState(false)
  const apple = account.session ? signsInWithApple(account.session) : false

  function settle(outcome: DeletionOutcome) {
    if (outcome === 'confirming') return
    setConfirming(false)
    setResuming(false)
    setComplaint(outcome === 'failed' ? 'failed' : outcome === 'unconfirmed' ? 'apple' : null)
    if (outcome === 'ok') onDeleted()
  }

  async function remove() {
    settle(await account.deleteAccount())
  }

  /* Back from Apple: the deletion this tab asked for goes on, once. */
  const userId = account.ready ? account.session?.user.id : undefined
  useEffect(() => {
    if (!userId) return
    const pending = takeDeletion(userId)
    if (pending === 'mismatch') setComplaint('apple')
    if (pending !== 'resume') return
    setResuming(true)
    void account.deleteAccount(true).then(settle)
    // Runs once per seeker coming back; the account's functions change with every render.
  }, [userId])

  return (
    <section className="account-delete" aria-label={t('profile.deleteAccount')}>
      <p className="account-lead">{t('profile.deleteAccountLead')}</p>
      <Button variant="danger" disabled={resuming} onClick={() => { setComplaint(null); setConfirming(true) }}>
        {t('profile.deleteAccount')}
      </Button>
      {resuming && <Notice live>{t('profilePage.deleting')}</Notice>}
      {complaint === 'failed' && <Notice tone="error">{t('profile.deleteAccountFailed')}</Notice>}
      {complaint === 'apple' && <Notice tone="error">{t('profilePage.deleteAppleFailed')}</Notice>}
      {confirming && (
        <Modal className="account-confirm" labelledBy="delete-account-title" closeLabel={t('profile.deleteAccountCancel')} onClose={() => setConfirming(false)}>
          <h2 id="delete-account-title">{t('profile.deleteAccountConfirm')}</h2>
          <p>{t('profile.deleteAccountBody')}</p>
          {apple && <p>{t('profilePage.deleteAppleNote')}</p>}
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
