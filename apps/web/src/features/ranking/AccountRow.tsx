import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { rankingShareUrl } from '@chatynkowo/core'
import { pageHref } from '../../components/SitePage'
import { useAccount } from '../../providers/AccountProvider'
import { Button, LinkButton, Notice, ProfileIcon, iconSize } from '../../ui'
import './Ranking.css'

/* The account line at the top of the leaderboard, the twin of the app's
   AccountRow: signed out, the way to the profile page, where signing in
   lives; signed in, who the seeker is, their place, a share of it and the
   way to edit the entry. The ranking itself never signs anyone in. */

const COPIED_MS = 2500

type AccountRowProps = {
  /* The seeker's 1-based place on the board, null when not listed,
     undefined while the board has not arrived. */
  place: number | null | undefined
}

export function AccountRow({ place }: AccountRowProps) {
  const { t } = useTranslation()
  const account = useAccount()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  if (!account.configured) return <Notice tone="note">{t('ranking.notConfigured')}</Notice>
  if (!account.ready) return null

  if (!account.session) {
    return (
      <div className="rank-account">
        <LinkButton variant="primary" href={pageHref('profile')}>
          <ProfileIcon size={iconSize.md} aria-hidden /> {t('ranking.signIn')}
        </LinkButton>
      </div>
    )
  }

  const profile = account.profile
  const name = profile?.display_name || t('profile.defaultName')

  /* The system share sheet where there is one, the clipboard elsewhere. */
  async function share() {
    if (!profile) return
    const url = rankingShareUrl(profile.public_id)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Chatynkowo', text: t('ranking.shareText'), url })
        return
      } catch {
        return // closed without sharing
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
  }

  return (
    <div className="rank-account">
      <p className="rank-hello">
        {t('profile.signedInPrefix')} <strong>{name}</strong>
        {place !== undefined && <span className="rank-hello__place">{place ? t('ranking.yourPlace', { place }) : t('ranking.notRanked')}</span>}
      </p>
      <span className="rank-account__actions">
        {profile && (
          <Button variant="primary" onClick={() => void share()}>
            {t('ranking.share')}
          </Button>
        )}
        <LinkButton href={pageHref('profile')}>{t('ranking.edit')}</LinkButton>
      </span>
      <Notice live tone={copied ? 'success' : undefined}>
        {copied && t('ranking.copied')}
      </Notice>
    </div>
  )
}
