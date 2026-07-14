import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { configured, ensureProfile, fetchLeaderboard, getSession, localFinds, signInWithGoogle, signOut, syncFinds, totalCottages, updateProfile, type LeaderboardRow, type Profile } from './lib/sync'
import './ranking.css'

function initials(name: string) { return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() }
function duration(value: LeaderboardRow['elapsed_seconds']) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 1) return 'bez czasu'
  const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60)
  if (days) return `${days} d ${hours} h`; if (hours) return `${hours} h ${minutes} min`; return minutes ? `${minutes} min` : `${Math.floor(seconds)} s`
}

function Avatar({ row }: { row: Pick<LeaderboardRow, 'avatar_url' | 'display_name'> }) {
  return row.avatar_url ? <img className="rank-ava" src={row.avatar_url} alt="" loading="lazy" /> : <span className="rank-ava rank-ava--initials" aria-hidden="true">{initials(row.display_name)}</span>
}

export function RankingApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [name, setName] = useState('')
  const [showAvatar, setShowAvatar] = useState(false)
  const modalRef = useRef<HTMLDialogElement>(null)
  const sharedId = new URLSearchParams(location.search).get('me')

  async function refresh() { setRows(await fetchLeaderboard()) }

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
        console.error(reason); setError('Nie udało się wczytać rankingu. Odśwież stronę i spróbuj ponownie.')
      } finally { setLoading(false) }
    })()
  }, [])

  async function shareResult() {
    const url = `${location.origin}${location.pathname}?me=${encodeURIComponent(profile?.public_id ?? '')}`
    if (navigator.share) { try { await navigator.share({ title: 'Chatynkowo', text: 'Zobacz mój wynik w Rankingu Zdobywców Chatynkowa!', url }); return } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url); setToast('Skopiowano link do schowka.'); window.setTimeout(() => setToast(''), 2500)
  }

  function openProfile() { setName(profile?.display_name ?? ''); setShowAvatar(Boolean(profile?.avatar_url)); modalRef.current?.showModal() }
  async function saveProfile() {
    if (!session) return
    const googleAvatar = String(session.user.user_metadata.avatar_url || session.user.user_metadata.picture || '') || null
    const updated = await updateProfile(session, { display_name: name || profile?.display_name || 'Zdobywca', avatar_url: showAvatar ? googleAvatar : null })
    setProfile(updated); modalRef.current?.close(); await refresh()
  }

  const mine = (row: LeaderboardRow) => row.public_id === (profile?.public_id || sharedId)
  const top = rows.slice(0, 3)

  return <>
    <a className="skip-link" href="#ranking-main">Przejdź do rankingu</a>
    <SiteHeader items={[{ label: 'Mapa wyprawy', href: 'index.html#mapa' }, { label: 'Wpisz kod', href: 'index.html#kod' }, { label: 'Notatnik', href: 'index.html#magia' }, { label: 'Wróć do gry', href: 'index.html', primary: true }]} />
    <main className="rank-main" id="ranking-main">
      <section className="rank-intro" aria-labelledby="ranking-title">
        <div className="rank-intro__copy"><p className="rank-eyebrow">Kronika jurajskich wypraw</p><h1 id="ranking-title">Ranking Zdobywców</h1><p className="rank-intro__lede">Zobacz tropicieli, którzy odnaleźli najwięcej opowieści Chatynkowa — i swoje miejsce w Kronice.</p>
          <div className="rank-account" aria-live="polite">{!configured ? <p className="rank-note">Ranking nie jest jeszcze skonfigurowany.</p> : !session ? <button className="rank-btn rank-btn--primary" onClick={() => void signInWithGoogle(location.href.split('?')[0])}>Zaloguj przez Google, aby dołączyć</button> : <><span className="rank-hello">Zalogowano jako <strong>{profile?.display_name || 'Zdobywca'}</strong></span><span className="rank-account__actions"><button className="rank-btn rank-btn--primary" onClick={() => void shareResult()}>Udostępnij mój wynik</button><button className="rank-btn" onClick={openProfile}>Edytuj wpis</button><button className="rank-btn rank-btn--ghost" onClick={() => void signOut().then(() => location.reload())}>Wyloguj</button></span>{toast && <span className="rank-toast">{toast}</span>}</>}</div>
        </div>
        <aside className="rank-method" aria-label="Zasady rankingu"><p className="rank-method__title">Jak liczymy wynik?</p><div><span className="rank-method__index">01</span><p><strong>Najpierw odkrycia</strong>Wyżej jest osoba, która znalazła więcej Chatynek.</p></div><div><span className="rank-method__index">02</span><p><strong>Potem czas wyprawy</strong>Czas mierzymy od pierwszego do ostatniego odkrycia.</p></div></aside>
      </section>
      <section className="rank-results" aria-labelledby="results-title">
        <header className="rank-results__header"><div><p className="rank-eyebrow">Najlepsi tropiciele</p><h2 id="results-title">Szczyt rankingu</h2></div><p>Wyniki aktualizują się po zapisaniu odkryć na zalogowanym koncie.</p></header>
        {top.length === 3 && <section className="podium" aria-label="Najlepsza trójka">{[top[1], top[0], top[2]].map((row, index) => { const place = [2, 1, 3][index]; return <article key={row.public_id} className={`podium__card podium__card--p${place}${mine(row) ? ' podium__card--mine' : ''}`}><div className="podium__medal">{place}</div><Avatar row={row} /><div className="podium__name">{row.display_name}</div><div className="podium__found">{row.found}/{total}</div><div className="podium__metric">czas: {duration(row.elapsed_seconds)}</div><div className="podium__base">Miejsce {place}</div></article> })}</section>}
        <section className="rank-board" aria-labelledby="full-ranking-title"><header className="rank-board__header"><h2 id="full-ranking-title">Wszyscy zdobywcy</h2><span>Odkrycia i czas wyprawy</span></header><ol className="rank-list">{rows.map((row, index) => <li key={row.public_id} className={`rank-row${mine(row) ? ' rank-row--mine' : ''}${row.completed ? ' rank-row--done' : ''}`}><span className="rank-pos">{index + 1}</span><Avatar row={row} /><span className="rank-name">{row.display_name}{mine(row) && <em className="rank-you"> (Ty)</em>}</span><span className="rank-count">{row.found}<small>/{total}</small></span><span className="rank-meta">czas: {duration(row.elapsed_seconds)}</span></li>)}</ol>{(loading || error || !rows.length) && <div className={`rank-status ${error ? 'is-error' : loading ? 'is-loading' : 'is-empty'}`}>{error || (loading ? 'Wczytuję kronikę wypraw...' : 'Kronika jest jeszcze pusta.')}</div>}</section>
        <aside className="rank-continue"><div><p className="rank-eyebrow">Twoja wyprawa trwa dalej</p><h2>Wróć na szlak</h2><p>Wybierz kolejną Chatynkę na mapie albo wpisz kod znaleziony podczas wędrówki.</p></div><div className="rank-continue__actions"><a className="rank-btn rank-btn--primary" href="index.html#mapa">Otwórz mapę</a><a className="rank-btn" href="index.html#kod">Mam kod</a></div></aside>
      </section>
    </main>
    <SiteFooter />
    <dialog className="modal modal--profile" ref={modalRef} aria-labelledby="profileTitle"><button className="modal__close" onClick={() => modalRef.current?.close()} aria-label="Zamknij">×</button><div className="modal__content"><p className="rank-eyebrow">Profil zdobywcy</p><h2 className="modal__title" id="profileTitle">Twój wpis w rankingu</h2><p className="modal__lede">Te dane zobaczą pozostali tropiciele.</p><label className="profile-field"><span>Pseudonim</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></label><label className="profile-check"><input type="checkbox" checked={showAvatar} onChange={(event) => setShowAvatar(event.target.checked)} /><span>Pokaż zdjęcie z konta Google</span></label><button className="rank-btn rank-btn--primary" onClick={() => void saveProfile()}>Zapisz zmiany</button></div></dialog>
  </>
}
