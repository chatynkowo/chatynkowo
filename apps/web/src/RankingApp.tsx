import { useEffect, useState } from 'react'
import type { Session } from '@chatynkowo/api'
import { DISPLAY_NAME_MAX_LENGTH, formatElapsed, initials } from '@chatynkowo/core'
import { useTranslation } from 'react-i18next'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { Button, LinkButton, Modal } from './ui'
import { configured, ensureProfile, fetchLeaderboard, getSession, providerAvatarUrl, signInWith, signOut, syncAccount, totalCottages, updateProfile, type LeaderboardRow, type OAuthProvider, type Profile } from './lib/sync'
import './ranking.css'

function Avatar({ row }: { row: Pick<LeaderboardRow, 'avatar_url' | 'display_name'> }) {
  return row.avatar_url ? <img className="rank-ava" src={row.avatar_url} alt="" loading="lazy" /> : <span className="rank-ava rank-ava--initials" aria-hidden="true">{initials(row.display_name)}</span>
}

export function RankingApp() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState('')
  const [showAvatar, setShowAvatar] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const sharedId = new URLSearchParams(location.search).get('me')

  async function refresh() { setRows(await fetchLeaderboard()) }

  useEffect(() => {
    document.title = t('meta.rankingTitle')
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.rankingDescription'))
  }, [t])

  /* The board loads whatever the account exchange does: a failed exchange
     is logged and tried again on the next visit, while the board still
     shows. */
  useEffect(() => {
    void (async () => {
      try {
        const [count, activeSession] = await Promise.all([totalCottages(), getSession()])
        setTotal(count); setSession(activeSession)
        if (activeSession) {
          try {
            setProfile(await ensureProfile(activeSession))
            await syncAccount(activeSession)
          } catch (reason) {
            console.error(reason)
          }
        }
        await refresh()
      } catch (reason) {
        console.error(reason); setLoadFailed(true)
      } finally { setLoading(false) }
    })()
  }, [])

  /* Back to this page without its query, where the client reads the session
     from the URL. */
  const signIn = (provider: OAuthProvider) => void signInWith(provider, location.href.split('?')[0]).catch((reason: unknown) => console.error(reason))

  async function shareResult() {
    const url = `${location.origin}${location.pathname}?me=${encodeURIComponent(profile?.public_id ?? '')}`
    if (navigator.share) { try { await navigator.share({ title: 'Chatynkowo', text: t('ranking.shareText'), url }); return } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2500)
  }

  function openProfile() { setName(profile?.display_name ?? ''); setShowAvatar(Boolean(profile?.avatar_url)); setSaveFailed(false); setProfileOpen(true) }
  /* A refused save keeps the dialog open with the complaint. */
  async function saveProfile() {
    if (!session) return
    try {
      const updated = await updateProfile(session, { display_name: name || profile?.display_name || t('ranking.defaultName'), avatar_url: showAvatar ? providerAvatarUrl(session) : null })
      setProfile(updated); setProfileOpen(false); await refresh()
    } catch (reason) {
      console.error(reason); setSaveFailed(true)
    }
  }

  const mine = (row: LeaderboardRow) => row.public_id === (profile?.public_id || sharedId)
  const top = rows.slice(0, 3)
  const timeLabel = (row: LeaderboardRow) => t('ranking.time', { value: formatElapsed(row.elapsed_seconds) ?? t('ranking.noTime') })

  return <>
    <a className="skip-link" href="#ranking-main">{t('ranking.skip')}</a>
    <SiteHeader items={[{ label: t('nav.map'), href: 'index.html#mapa' }, { label: t('nav.enterCode'), href: 'index.html#kod' }, { label: t('nav.notebook'), href: 'index.html#magia' }, { label: t('nav.about'), href: 'index.html#o-chatynkowie' }, { label: t('nav.backToGame'), href: 'index.html', primary: true }]} />
    <main className="rank-main" id="ranking-main">
      <section className="rank-intro" aria-labelledby="ranking-title">
        <div className="rank-intro__copy"><p className="rank-eyebrow">{t('ranking.eyebrow')}</p><h1 id="ranking-title">{t('ranking.title')}</h1><p className="rank-intro__lede">{t('ranking.lede')}</p>
          <div className="rank-account" aria-live="polite">{!configured ? <p className="rank-note">{t('ranking.notConfigured')}</p> : !session ? <><span className="rank-hello">{t('ranking.signIn')}</span><span className="rank-account__actions"><Button variant="primary" onClick={() => signIn('google')}>{t('ranking.signInGoogle')}</Button><Button onClick={() => signIn('apple')}>{t('ranking.signInApple')}</Button></span></> : <><span className="rank-hello">{t('ranking.signedInPrefix')} <strong>{profile?.display_name || t('ranking.defaultName')}</strong></span><span className="rank-account__actions"><Button variant="primary" onClick={() => void shareResult()}>{t('ranking.share')}</Button><Button onClick={openProfile}>{t('ranking.edit')}</Button><Button variant="subtle" onClick={() => void signOut().then(() => location.reload()).catch((reason: unknown) => console.error(reason))}>{t('ranking.signOut')}</Button></span>{copied && <span className="rank-toast">{t('ranking.copied')}</span>}</>}</div>
        </div>
        <aside className="rank-method" aria-label={t('ranking.rulesAria')}><p className="rank-method__title">{t('ranking.rulesTitle')}</p><div><span className="rank-method__index">01</span><p><strong>{t('ranking.rule1Title')}</strong>{t('ranking.rule1Body')}</p></div><div><span className="rank-method__index">02</span><p><strong>{t('ranking.rule2Title')}</strong>{t('ranking.rule2Body')}</p></div></aside>
      </section>
      <section className="rank-results" aria-labelledby="results-title">
        <header className="rank-results__header"><div><p className="rank-eyebrow">{t('ranking.topEyebrow')}</p><h2 id="results-title">{t('ranking.topTitle')}</h2></div><p>{t('ranking.topNote')}</p></header>
        {top.length === 3 && <section className="podium" aria-label={t('ranking.podiumAria')}>{[top[1], top[0], top[2]].map((row, index) => { const place = [2, 1, 3][index]; return <article key={row.public_id} className={`podium__card podium__card--p${place}${mine(row) ? ' podium__card--mine' : ''}`}><div className="podium__medal">{place}</div><Avatar row={row} /><div className="podium__name">{row.display_name}</div><div className="podium__found">{row.found}/{total}</div><div className="podium__metric">{timeLabel(row)}</div><div className="podium__base">{t('ranking.place', { place })}</div></article> })}</section>}
        <section className="rank-board" aria-labelledby="full-ranking-title"><header className="rank-board__header"><h2 id="full-ranking-title">{t('ranking.allTitle')}</h2><span>{t('ranking.allSubtitle')}</span></header><ol className="rank-list">{rows.map((row, index) => <li key={row.public_id} className={`rank-row${mine(row) ? ' rank-row--mine' : ''}${row.completed ? ' rank-row--done' : ''}`}><span className="rank-pos">{index + 1}</span><Avatar row={row} /><span className="rank-name">{row.display_name}{mine(row) && <em className="rank-you"> {t('ranking.you')}</em>}</span><span className="rank-count">{row.found}<small>/{total}</small></span><span className="rank-meta">{timeLabel(row)}</span></li>)}</ol>{(loading || loadFailed || !rows.length) && <div className={`rank-status ${loadFailed ? 'is-error' : loading ? 'is-loading' : 'is-empty'}`}>{loadFailed ? t('ranking.loadError') : loading ? t('ranking.loading') : t('ranking.empty')}</div>}</section>
        <aside className="rank-continue"><div><p className="rank-eyebrow">{t('ranking.continueEyebrow')}</p><h2>{t('ranking.continueTitle')}</h2><p>{t('ranking.continueBody')}</p></div><div className="rank-continue__actions"><LinkButton variant="primary" href="index.html#mapa">{t('ranking.openMap')}</LinkButton><LinkButton href="index.html#kod">{t('ranking.haveCode')}</LinkButton></div></aside>
      </section>
    </main>
    <SiteFooter />
    {profileOpen && (
      <Modal className="profile-modal" labelledBy="profileTitle" closeLabel={t('ranking.profileClose')} onClose={() => setProfileOpen(false)}>
        <p className="rank-eyebrow">{t('ranking.profileEyebrow')}</p>
        <h2 id="profileTitle">{t('ranking.profileTitle')}</h2>
        <p className="profile-lede">{t('ranking.profileLede')}</p>
        <label className="profile-field"><span>{t('ranking.nickname')}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={DISPLAY_NAME_MAX_LENGTH} /></label>
        <label className="profile-check"><input type="checkbox" checked={showAvatar} onChange={(event) => setShowAvatar(event.target.checked)} /><span>{t('ranking.showAvatar')}</span></label>
        <Button variant="primary" onClick={() => void saveProfile()}>{t('ranking.save')}</Button>
        {saveFailed && <p className="rank-note" role="alert">{t('ranking.saveFailed')}</p>}
      </Modal>
    )}
  </>
}
