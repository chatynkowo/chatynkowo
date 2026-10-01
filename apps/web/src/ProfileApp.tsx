import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { SitePage } from './components/SitePage'
import { ACCOUNT_TITLE_ID, AccountCard } from './features/account/AccountCard'
import { SignOutSection } from './features/account/SignOutSection'
import { useAccount, useAccountExchange } from './providers/AccountProvider'
import { ProfileIcon, iconSize } from './ui'

/* The profile page, the site's twin of the app's Profile tab: what an
   account is for, the account block (the way in, or who is signed in and
   their leaderboard entry) and the way out. The language, the lore and
   the legal and social links are the header and the footer, as on every
   page. */

export function ProfileApp() {
  const { t } = useTranslation()
  const account = useAccount()
  const exchange = useAccountExchange()

  /* A sign-out takes the dialog and its button off the page; focus moves
     to the card that now offers the way back in, so a keyboard or
     screen-reader user keeps their place. */
  const hadSession = useRef(false)
  useEffect(() => {
    if (hadSession.current && !account.session) document.getElementById(ACCOUNT_TITLE_ID)?.focus()
    hadSession.current = account.session !== null
  }, [account.session])

  return (
    <SitePage page="profile" mainClassName="profile-main">
      <section className="profile-intro" aria-labelledby="profile-title">
        <p className="eyebrow">
          <ProfileIcon size={iconSize.sm} weight="fill" aria-hidden /> {t('profilePage.eyebrow')}
        </p>
        <h1 id="profile-title">{t('profilePage.title')}</h1>
        <p className="profile-intro__lede">{t('profilePage.lede')}</p>
      </section>
      <AccountCard exchange={exchange} />
      {account.session && <SignOutSection />}
    </SitePage>
  )
}
