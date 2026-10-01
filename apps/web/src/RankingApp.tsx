import { useEffect, useState } from 'react'
import { formatElapsed } from '@chatynkowo/core'
import { useTranslation } from 'react-i18next'
import { SitePage } from './components/SitePage'
import { AccountRow } from './features/ranking/AccountRow'
import { useAccount, useAccountExchange } from './providers/AccountProvider'
import { Avatar, LinkButton } from './ui'
import { fetchLeaderboard, totalCottages, type LeaderboardRow } from './lib/sync'

/* The leaderboard: the podium, the full board and the way back to the
   trail. The account only appears as the row at the top (AccountRow);
   signing in and the profile live on the profile page. */

export function RankingApp() {
  const { t } = useTranslation()
  const account = useAccount()
  const exchange = useAccountExchange()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const sharedId = new URLSearchParams(location.search).get('me')

  /* The board loads once the exchange with the account settled, so it
     reflects this browser's finds; a failed load is said on the page. */
  useEffect(() => {
    if (!exchange.settled) return
    let current = true
    void Promise.all([totalCottages(), fetchLeaderboard()])
      .then(([count, list]) => {
        if (!current) return
        setTotal(count)
        setRows(list)
      })
      .catch((reason: unknown) => {
        console.error(reason)
        if (current) setLoadFailed(true)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [exchange.settled])

  const mine = (row: LeaderboardRow) => row.public_id === (account.profile?.public_id || sharedId)
  /* Unknown until the board is here; null when the seeker is not on it. */
  const place = loading || loadFailed ? undefined : rows.findIndex(mine) + 1 || null
  const top = rows.slice(0, 3)
  const timeLabel = (row: LeaderboardRow) => t('ranking.time', { value: formatElapsed(row.elapsed_seconds) ?? t('ranking.noTime') })

  return (
    <SitePage page="ranking" mainClassName="rank-main">
      <section className="rank-intro" aria-labelledby="ranking-title">
        <div className="rank-intro__copy"><p className="eyebrow">{t('ranking.eyebrow')}</p><h1 id="ranking-title">{t('ranking.title')}</h1><p className="rank-intro__lede">{t('ranking.lede')}</p>
          <AccountRow place={place} />
        </div>
        <aside className="rank-method" aria-label={t('ranking.rulesAria')}><p className="rank-method__title">{t('ranking.rulesTitle')}</p><div><span className="rank-method__index">01</span><p><strong>{t('ranking.rule1Title')}</strong>{t('ranking.rule1Body')}</p></div><div><span className="rank-method__index">02</span><p><strong>{t('ranking.rule2Title')}</strong>{t('ranking.rule2Body')}</p></div></aside>
      </section>
      <section className="rank-results" aria-labelledby="results-title">
        <header className="rank-results__header"><div><p className="eyebrow">{t('ranking.topEyebrow')}</p><h2 id="results-title">{t('ranking.topTitle')}</h2></div><p>{t('ranking.topNote')}</p></header>
        {top.length === 3 && <section className="podium" aria-label={t('ranking.podiumAria')}>{[top[1], top[0], top[2]].map((row, index) => { const place = [2, 1, 3][index]; return <article key={row.public_id} className={`podium__card podium__card--p${place}${mine(row) ? ' podium__card--mine' : ''}`}><div className="podium__medal">{place}</div><Avatar name={row.display_name} src={row.avatar_url} /><div className="podium__name">{row.display_name}</div><div className="podium__found">{row.found}/{total}</div><div className="podium__metric">{timeLabel(row)}</div><div className="podium__base">{t('ranking.place', { place })}</div></article> })}</section>}
        <section className="rank-board" aria-labelledby="full-ranking-title"><header className="rank-board__header"><h2 id="full-ranking-title">{t('ranking.allTitle')}</h2><span>{t('ranking.allSubtitle')}</span></header><ol className="rank-list">{rows.map((row, index) => <li key={row.public_id} className={`rank-row${mine(row) ? ' rank-row--mine' : ''}${row.completed ? ' rank-row--done' : ''}`}><span className="rank-pos">{index + 1}</span><Avatar name={row.display_name} src={row.avatar_url} /><span className="rank-name">{row.display_name}{mine(row) && <em className="rank-you"> {t('ranking.you')}</em>}</span><span className="rank-count">{row.found}<small>/{total}</small></span><span className="rank-meta">{timeLabel(row)}</span></li>)}</ol>{(loading || loadFailed || !rows.length) && <div className={`rank-status ${loadFailed ? 'is-error' : loading ? 'is-loading' : 'is-empty'}`}>{loadFailed ? t('ranking.loadError') : loading ? t('ranking.loading') : t('ranking.empty')}</div>}</section>
        <aside className="rank-continue"><div><p className="eyebrow">{t('ranking.continueEyebrow')}</p><h2>{t('ranking.continueTitle')}</h2><p>{t('ranking.continueBody')}</p></div><div className="rank-continue__actions"><LinkButton variant="primary" href="index.html#mapa">{t('ranking.openMap')}</LinkButton><LinkButton href="index.html#kod">{t('ranking.haveCode')}</LinkButton></div></aside>
      </section>
    </SitePage>
  )
}
