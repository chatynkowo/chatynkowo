import { useTranslation } from 'react-i18next'
import type { OAuthProvider, Profile, Session } from '../../lib/sync'
import { sessionEmail, sessionProvider } from '../../lib/sync'
import { Avatar } from '../../ui'
import './Account.css'

/* Who the seeker is signed in as, on the profile page and the deletion
   page alike: the picture the leaderboard shows (or the initials), the
   nickname, the provider and the address the provider shared. The
   nickname falls back to the default while the profile row is unread. */

const PROVIDER_NAME: Record<OAuthProvider, string> = { google: 'profile.providerGoogle', apple: 'profile.providerApple' }

export function AccountIdentity({ session, profile }: { session: Session; profile: Profile | null }) {
  const { t } = useTranslation()
  const displayName = profile?.display_name || t('profile.defaultName')
  const provider = sessionProvider(session)
  const email = sessionEmail(session)
  return (
    <p className="account-identity">
      <Avatar name={displayName} src={profile?.avatar_url ?? null} />
      <span className="account-identity__text">
        <strong>{displayName}</strong>
        {provider && <small>{t('profile.signedInWith', { provider: t(PROVIDER_NAME[provider]) })}</small>}
        {email && <small>{email}</small>}
      </span>
    </p>
  )
}
