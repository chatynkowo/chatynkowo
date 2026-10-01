import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccount } from '../../providers/AccountProvider'
import { OAUTH_PROVIDERS, enabledProviders, type OAuthProvider } from '../../lib/sync'
import { Button, Notice } from '../../ui'
import './Account.css'

/* The way in: a button per provider the backend has switched on, read
   from its settings when the panel mounts (unreadable settings offer
   every provider; the backend answers on the way). Nothing while the
   list is unknown; a note instead of buttons when there is no backend or
   no provider. */

export function SignInPanel() {
  const { t } = useTranslation()
  const account = useAccount()
  const [providers, setProviders] = useState<OAuthProvider[] | null>(null)

  useEffect(() => {
    if (!account.configured) return
    let current = true
    enabledProviders()
      .catch((reason: unknown) => {
        console.error('[account] providers', reason)
        return [...OAUTH_PROVIDERS]
      })
      .then((offered) => {
        if (current) setProviders(offered)
      })
    return () => {
      current = false
    }
  }, [account.configured])

  if (!account.configured || providers?.length === 0) {
    return <Notice tone="note">{t('profile.signInUnavailable')}</Notice>
  }

  return (
    <div className="signin-panel">
      <p className="account-lead">{t('profile.signInLead')}</p>
      {providers && (
        <div className="signin-buttons">
          {providers.includes('google') && (
            <Button variant="primary" onClick={() => account.signIn('google')}>
              {t('profile.signInGoogle')}
            </Button>
          )}
          {providers.includes('apple') && <Button onClick={() => account.signIn('apple')}>{t('profile.signInApple')}</Button>}
        </div>
      )}
    </div>
  )
}
