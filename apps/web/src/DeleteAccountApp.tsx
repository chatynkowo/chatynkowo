import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SitePage, pageHref } from './components/SitePage'
import { AccountIdentity } from './features/account/AccountIdentity'
import { DeleteAccountSection } from './features/account/DeleteAccountSection'
import { SignInPanel } from './features/account/SignInPanel'
import { useAccount } from './providers/AccountProvider'
import { LinkButton, ProfileIcon, iconSize } from './ui'

/* The page the store listings point to as the place to delete the
   account: what the deletion removes, what stays, how to do it in the app
   and here, then the action itself. It reads whole without an account (a
   store reviewer opens it signed out): the card then offers the way in;
   signed in, it names the account and holds the deletion; afterwards it
   says the account is gone and leads back to the game. */

export function DeleteAccountApp() {
  const { t } = useTranslation()

  return (
    <SitePage page="deleteAccount" mainClassName="delete-main">
      <section className="delete-intro" aria-labelledby="delete-title">
        <p className="eyebrow">
          <ProfileIcon size={iconSize.sm} weight="fill" aria-hidden /> {t('deleteAccountPage.eyebrow')}
        </p>
        <h1 id="delete-title">{t('deleteAccountPage.title')}</h1>
        <p className="delete-intro__lede">{t('deleteAccountPage.lede')}</p>
      </section>
      <section className="delete-section" aria-labelledby="delete-removes-title">
        <h2 id="delete-removes-title">{t('deleteAccountPage.removesTitle')}</h2>
        <ul>
          <li>{t('deleteAccountPage.removesAccount')}</li>
          <li>{t('deleteAccountPage.removesProfile')}</li>
          <li>{t('deleteAccountPage.removesFinds')}</li>
        </ul>
      </section>
      <section className="delete-section" aria-labelledby="delete-keeps-title">
        <h2 id="delete-keeps-title">{t('deleteAccountPage.keepsTitle')}</h2>
        <p>{t('deleteAccountPage.keepsBody')}</p>
      </section>
      <section className="delete-section" aria-labelledby="delete-how-title">
        <h2 id="delete-how-title">{t('deleteAccountPage.howTitle')}</h2>
        <ul>
          <li>{t('deleteAccountPage.howApp')}</li>
          <li>{t('deleteAccountPage.howWeb')}</li>
        </ul>
      </section>
      <DeleteAccountCard />
      <p className="delete-contact">{t('deleteAccountPage.contact')}</p>
    </SitePage>
  )
}

/* The action card: nothing until the account is known, the way in while
   signed out, the identity and the deletion while signed in, the farewell
   once the account is gone (the session is gone with it, so this state
   has to be remembered here). */
function DeleteAccountCard() {
  const { t } = useTranslation()
  const account = useAccount()
  const { session, profile } = account
  const [deleted, setDeleted] = useState(false)

  /* The deletion takes the dialog and its button off the page; focus
     moves to the farewell so a keyboard or screen-reader user hears it. */
  const doneRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (deleted) doneRef.current?.focus()
  }, [deleted])

  if (!account.ready) return null

  if (deleted) {
    return (
      <section className="account-card" aria-labelledby="delete-done-title">
        <h2 id="delete-done-title" ref={doneRef} className="account-card__title" tabIndex={-1}>
          {t('deleteAccountPage.doneTitle')}
        </h2>
        <p className="account-lead">{t('deleteAccountPage.doneBody')}</p>
        <div>
          <LinkButton variant="primary" href={pageHref('home')}>{t('deleteAccountPage.backToGame')}</LinkButton>
        </div>
      </section>
    )
  }

  if (!session) {
    return (
      <section className="account-card" aria-labelledby="delete-account-card-title">
        <h2 id="delete-account-card-title" className="account-card__title">{t('profile.account')}</h2>
        <SignInPanel lead={t('deleteAccountPage.signInLead')} />
      </section>
    )
  }

  return (
    <section className="account-card" aria-labelledby="delete-account-card-title">
      <h2 id="delete-account-card-title" className="account-card__title">{t('profile.account')}</h2>
      <AccountIdentity session={session} profile={profile} />
      <DeleteAccountSection onDeleted={() => setDeleted(true)} />
    </section>
  )
}
