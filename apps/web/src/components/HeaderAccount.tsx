import { useTranslation } from 'react-i18next'
import { useAccount } from '../providers/AccountProvider'
import { Avatar, ProfileIcon, iconSize } from '../ui'
import { pageHref, type SitePageId } from './SitePage'
import './SiteChrome.css'

/* The account in the header of every page: the way in while signed out,
   the seeker's picture and name once signed in, both leading to the
   profile page. Until the account is known it is the icon alone, named
   "account", so neither the label nor the name swaps in front of the
   reader. Nothing without a backend. */

export function HeaderAccount({ page }: { page: SitePageId }) {
  const { t } = useTranslation()
  const account = useAccount()
  if (!account.configured) return null

  const name = account.profile?.display_name || t('profile.defaultName')
  const signedIn = account.ready && account.session !== null
  return (
    <a
      className="header-account"
      href={pageHref('profile')}
      aria-current={page === 'profile' ? 'page' : undefined}
      aria-label={!account.ready ? t('profile.account') : signedIn ? `${t('profile.signedInPrefix')} ${name}` : t('header.signIn')}
    >
      {signedIn ? (
        <Avatar name={name} src={account.profile?.avatar_url ?? null} />
      ) : (
        <ProfileIcon size={iconSize.md} weight={account.ready ? 'regular' : 'duotone'} aria-hidden />
      )}
      {account.ready && <span className="header-account__label">{signedIn ? name : t('header.signIn')}</span>}
    </a>
  )
}
