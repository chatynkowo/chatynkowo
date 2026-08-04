import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { configured, ensureProfile, fetchLeaderboard, getSession, localFinds, signInWithGoogle, signOut, syncFinds, totalCottages, updateProfile, type LeaderboardRow, type Profile } from './lib/sync'
import './ranking.css'

function initials(name: string) { return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() }
/* Formats the expedition duration, or returns null when there is none — the
   caller renders the localized "no time" fallback. The unit letters (d/h/min/s)
   read the same in Polish and English. */
function duration(value: LeaderboardRow['elapsed_seconds']) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 1) return null
  const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60)
  if (days) return `${days} d ${hours} h`; if (hours) return `${hours} h ${minutes} min`; return minutes ? `${minutes} min` : `${Math.floor(seconds)} s`
}

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
  const modalRef = useRef<HTMLDialogElement>(null)
  const sharedId = new URLSearchParams(location.search).get('me')

  async function refresh() { setRows(await fetchLeaderboard()) }

  useEffect(() => {
    document.title = t('meta.rankingTitle')
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.rankingDescription'))
  }, [t])

  useEffect(() => {
    void (async () => {
      try {
        const [count, activeSession] = await Promise.all([totalCottages(), getSession()])
        setTotal(count); setSession(activeSession)
        if (activeSession) {
          const currentProfile = await ensureProfile(activeSession)
          setProfile(currentProfile)
          await syncFinds(activeSession, localFinds())
        }
        await refresh()
      } catch (reason) {
        console.error(reason); setLoadFailed(true)
      } finally { setLoading(false) }
    })()
  }, [])

  async function shareResult() {
    const url = `${location.origin}${location.pathname}?me=${encodeURIComponent(profile?.public_id ?? '')}`
    if (navigator.share) { try { await navigator.share({ title: 'Chatynkowo', text: t('ranking.shareText'), url }); return } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2500)
  }

  function openProfile() { setName(profile?.display_name ?? ''); setShowAvatar(Boolean(profile?.avatar_url)); modalRef.current?.showModal() }
  async function saveProfile() {
    if (!session) return
    const googleAvatar = String(session.user.user_metadata.avatar_url || session.user.user_metadata.picture || '') || null
    const updated = await updateProfile(session, { display_name: name || profile?.display_name || t('ranking.defaultName'), avatar_url: showAvatar ? googleAvatar : null })
    setProfile(updated); modalRef.current?.close(); await refresh()
  }

  const mine = (row: LeaderboardRow) => row.public_id === (profile?.public_id || sharedId)
  const top = rows.slice(0, 3)
  const timeLabel = (row: LeaderboardRow) => t('ranking.time', { value: duration(row.elapsed_seconds) ?? t('ranking.noTime') })

  return <>
    <a className="skip-link" href="#ranking-main">{t('ranking.skip')}</a>
    <SiteHeader items={[{ label: t('nav.map'), href: 'index.html#mapa' }, { label: t('nav.enterCode'), href: 'index.html#kod' }, { label: t('nav.notebook'), href: 'index.html#magia' }, { label: t('nav.about'), href: 'index.html#o-chatynkowie' }, { label: t('nav.backToGame'), href: 'index.html', primary: true }]} />
    <main className="rank-main" id="ranking-main">
      <section className="rank-intro" aria-labelledby="ranking-title">
        <div className="rank-intro__copy"><p className="rank-eyebrow">{t('ranking.eyebrow')}</p><h1 id="ranking-title">{t('ranking.title')}</h1><p className="rank-intro__lede">{t('ranking.lede')}</p>
          <div className="rank-account" aria-live="polite">{!configured ? <p className="rank-note">{t('ranking.notConfigured')}</p> : !session ? <button className="rank-btn rank-btn--primary" onClick={() => void signInWithGoogle(location.href.split('?')[0])}>{t('ranking.signIn')}</button> : <><span className="rank-hello">{t('ranking.signedInPrefix')} <strong>{profile?.display_name || t('ranking.defaultName')}</strong></span><span className="rank-account__actions"><button className="rank-btn rank-btn--primary" onClick={() => void shareResult()}>{t('ranking.share')}</button><button className="rank-btn" onClick={openProfile}>{t('ranking.edit')}</button><button className="rank-btn rank-btn--ghost" onClick={() => void signOut().then(() => location.reload())}>{t('ranking.signOut')}</button></span>{copied && <span className="rank-toast">{t('ranking.copied')}</span>}</>}</div>
        </div>
        <aside className="rank-method" aria-label={t('ranking.rulesAria')}><p className="rank-method__title">{t('ranking.rulesTitle')}</p><div><span className="rank-method__index">01</span><p><strong>{t('ranking.rule1Title')}</strong>{t('ranking.rule1Body')}</p></div><div><span className="rank-method__index">02</span><p><strong>{t('ranking.rule2Title')}</strong>{t('ranking.rule2Body')}</p></div></aside>
      </section>
      <section className="rank-results" aria-labelledby="results-title">
        <header className="rank-results__header"><div><p className="rank-eyebrow">{t('ranking.topEyebrow')}</p><h2 id="results-title">{t('ranking.topTitle')}</h2></div><p>{t('ranking.topNote')}</p></header>
        {top.length === 3 && <section className="podium" aria-label={t('ranking.podiumAria')}>{[top[1], top[0], top[2]].map((row, index) => { const place = [2, 1, 3][index]; return <article key={row.public_id} className={`podium__card podium__card--p${place}${mine(row) ? ' podium__card--mine' : ''}`}><div className="podium__medal">{place}</div><Avatar row={row} /><div className="podium__name">{row.display_name}</div><div className="podium__found">{row.found}/{total}</div><div className="podium__metric">{timeLabel(row)}</div><div className="podium__base">{t('ranking.place', { place })}</div></article> })}</section>}
        <section className="rank-board" aria-labelledby="full-ranking-title"><header className="rank-board__header"><h2 id="full-ranking-title">{t('ranking.allTitle')}</h2><span>{t('ranking.allSubtitle')}</span></header><ol className="rank-list">{rows.map((row, index) => <li key={row.public_id} className={`rank-row${mine(row) ? ' rank-row--mine' : ''}${row.completed ? ' rank-row--done' : ''}`}><span className="rank-pos">{index + 1}</span><Avatar row={row} /><span className="rank-name">{row.display_name}{mine(row) && <em className="rank-you"> {t('ranking.you')}</em>}</span><span className="rank-count">{row.found}<small>/{total}</small></span><span className="rank-meta">{timeLabel(row)}</span></li>)}</ol>{(loading || loadFailed || !rows.length) && <div className={`rank-status ${loadFailed ? 'is-error' : loading ? 'is-loading' : 'is-empty'}`}>{loadFailed ? t('ranking.loadError') : loading ? t('ranking.loading') : t('ranking.empty')}</div>}</section>
        <aside className="rank-continue"><div><p className="rank-eyebrow">{t('ranking.continueEyebrow')}</p><h2>{t('ranking.continueTitle')}</h2><p>{t('ranking.continueBody')}</p></div><div className="rank-continue__actions"><a className="rank-btn rank-btn--primary" href="index.html#mapa">{t('ranking.openMap')}</a><a className="rank-btn" href="index.html#kod">{t('ranking.haveCode')}</a></div></aside>
      </section>
    </main>
    <SiteFooter />
    <dialog className="modal modal--profile" ref={modalRef} aria-labelledby="profileTitle"><button className="modal__close" onClick={() => modalRef.current?.close()} aria-label={t('ranking.profileClose')}>×</button><div className="modal__content"><p className="rank-eyebrow">{t('ranking.profileEyebrow')}</p><h2 className="modal__title" id="profileTitle">{t('ranking.profileTitle')}</h2><p className="modal__lede">{t('ranking.profileLede')}</p><label className="profile-field"><span>{t('ranking.nickname')}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></label><label className="profile-check"><input type="checkbox" checked={showAvatar} onChange={(event) => setShowAvatar(event.target.checked)} /><span>{t('ranking.showAvatar')}</span></label><button className="rank-btn rank-btn--primary" onClick={() => void saveProfile()}>{t('ranking.save')}</button></div></dialog>
  </>
}
