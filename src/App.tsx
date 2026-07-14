import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  Crown,
  Footprints,
  Key,
  LockKeyOpen,
  MapTrifold,
  ShieldCheck,
  SpeakerHigh,
  Trophy,
  X,
} from '@phosphor-icons/react'
import { marked } from 'marked'
import { loadCottages, resolveCode } from './lib/content'
import { BADGES, discoverCottage, loadStoredState } from './lib/persistence'
import { initializeAnalytics, track } from './lib/analytics'
import { syncNewFind } from './lib/sync'
import type { Cottage, StoredState } from './types'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { AudioPlayer } from './components/AudioPlayer'

const STORY_IMAGES = [
  'assets/img/WhatsApp-Image-2026-01-26-at-23.08.00-1.webp',
  'assets/img/683x1024/WhatsApp-Image-2026-01-26-at-23.08.04-1-683x1024.webp',
  'assets/img/WhatsApp-Image-2026-01-27-at-22.45.46.webp',
  'assets/img/683x1024/WhatsApp-Image-2026-01-27-at-22.51.33-683x1024.webp',
  'assets/img/WhatsApp-Image-2026-02-12-at-13.25.30.webp',
]

const EMPTY_PIN = ['', '', '', '']

const MapExplorer = lazy(() =>
  import('./components/MapExplorer').then((module) => ({ default: module.MapExplorer })),
)

function storyImage(cottage: Cottage) {
  const index = Array.from(cottage.slug).reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return STORY_IMAGES[index % STORY_IMAGES.length]
}

function discoveryCountLabel(count: number) {
  if (count === 1) return '1 odkrycie'
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo < 12 || lastTwo > 14) {
    if (last >= 2 && last <= 4) return `${count} odkrycia`
  }
  return `${count} odkryć`
}

function App() {
  const [cottages, setCottages] = useState<Cottage[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [stored, setStored] = useState<StoredState>(() => loadStoredState())
  const [codeDigits, setCodeDigits] = useState<string[]>(() => [...EMPTY_PIN])
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'error'>('idle')
  const [codeMessage, setCodeMessage] = useState('')
  const [story, setStory] = useState<Cottage | null>(null)
  const [storyPreviouslyFound, setStoryPreviouslyFound] = useState(false)
  const [treasuryOpen, setTreasuryOpen] = useState(false)
  const [achievement, setAchievement] = useState('')
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([])

  const foundSlugs = useMemo(() => new Set(Object.keys(stored.found)), [stored.found])
  const foundCount = foundSlugs.size
  const progressPercent = cottages.length ? Math.round((foundCount / cottages.length) * 100) : 0
  const nextBadge = BADGES.find((badge) => !stored.badges[badge.id])
  const nextBadgeTarget = nextBadge?.final ? cottages.length : nextBadge?.threshold ?? cottages.length
  const discoveriesToNextBadge = Math.max(0, nextBadgeTarget - foundCount)

  useEffect(() => {
    let current = true
    loadCottages()
      .then((loaded) => {
        if (!current) return
        setCottages(loaded)
        setLoadState('ready')
      })
      .catch(() => {
        if (current) setLoadState('error')
      })
    const cleanupAnalytics = initializeAnalytics()
    return () => {
      current = false
      cleanupAnalytics()
    }
  }, [])

  useEffect(() => {
    if (loadState === 'loading' || !window.location.hash) return
    const target = document.querySelector(window.location.hash)
    window.setTimeout(() => target?.scrollIntoView({ block: 'start' }), 80)
  }, [loadState])

  useEffect(() => {
    document.body.classList.toggle('modal-open', Boolean(story || treasuryOpen))
    return () => document.body.classList.remove('modal-open')
  }, [story, treasuryOpen])

  useEffect(() => {
    if (!story && !treasuryOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const backgroundElements = document.querySelectorAll<HTMLElement>(
      '.site-header, main, .site-footer, .treasury-toggle',
    )
    backgroundElements.forEach((element) => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })
    const closeModal = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setStory(null)
      setTreasuryOpen(false)
    }
    document.addEventListener('keydown', closeModal)
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.modal-card .modal-close')?.focus()
    })
    return () => {
      document.removeEventListener('keydown', closeModal)
      backgroundElements.forEach((element) => {
        element.inert = false
        element.removeAttribute('aria-hidden')
      })
      previousFocus?.focus()
    }
  }, [story, treasuryOpen])

  const openCode = useCallback(() => {
    const mobile = window.matchMedia('(max-width: 760px)').matches
    const firstEmpty = codeDigits.findIndex((digit) => !digit)
    const input = codeInputRefs.current[firstEmpty < 0 ? 0 : firstEmpty]

    // Mobile browsers only open the numeric keyboard when focus is requested
    // directly from the user's click, not from a delayed callback.
    input?.focus({ preventScroll: true })
    input?.select()
    window.requestAnimationFrame(() => {
      document.getElementById('kod')?.scrollIntoView({
        behavior: 'smooth',
        block: mobile ? 'start' : 'center',
      })
    })
  }, [codeDigits])

  function clearCodeFeedback() {
    if (codeState !== 'idle') setCodeState('idle')
    if (codeMessage) setCodeMessage('')
  }

  function fillPin(startIndex: number, rawValue: string) {
    const digits = rawValue.replace(/\D/g, '').slice(0, 4 - startIndex)
    if (!digits) return

    setCodeDigits((current) => {
      const next = [...current]
      digits.split('').forEach((digit, offset) => {
        next[startIndex + offset] = digit
      })
      return next
    })
    clearCodeFeedback()
    const nextIndex = Math.min(startIndex + digits.length, 3)
    codeInputRefs.current[nextIndex]?.focus()
  }

  function changePinDigit(index: number, rawValue: string) {
    const digits = rawValue.replace(/\D/g, '')
    if (digits.length > 1) {
      fillPin(index, digits)
      return
    }

    setCodeDigits((current) => {
      const next = [...current]
      next[index] = digits
      return next
    })
    clearCodeFeedback()
    if (digits && index < 3) codeInputRefs.current[index + 1]?.focus()
  }

  function handlePinKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      codeInputRefs.current[index - 1]?.focus()
      return
    }
    if (event.key === 'ArrowRight' && index < 3) {
      event.preventDefault()
      codeInputRefs.current[index + 1]?.focus()
      return
    }
    if (event.key !== 'Backspace') return

    event.preventDefault()
    if (codeDigits[index]) {
      setCodeDigits((current) => current.map((digit, digitIndex) => digitIndex === index ? '' : digit))
      clearCodeFeedback()
      return
    }
    if (index > 0) {
      setCodeDigits((current) => current.map((digit, digitIndex) => digitIndex === index - 1 ? '' : digit))
      clearCodeFeedback()
      codeInputRefs.current[index - 1]?.focus()
    }
  }

  function handlePinPaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!digits) return
    event.preventDefault()
    fillPin(index, digits)
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault()
    const normalized = codeDigits.join('')
    if (!/^\d{4}$/.test(normalized)) {
      setCodeState('error')
      setCodeMessage('Wpisz dokładnie cztery cyfry z tabliczki.')
      const firstEmpty = codeDigits.findIndex((digit) => !digit)
      codeInputRefs.current[firstEmpty < 0 ? 0 : firstEmpty]?.focus()
      return
    }

    setCodeState('checking')
    setCodeMessage('Sprawdzam kod w kronice Chatynkowa...')
    try {
      const slug = await resolveCode(normalized)
      const cottage = cottages.find((item) => item.slug === slug)
      if (!cottage) {
        setCodeState('error')
        setCodeMessage('Ten kod nie otwiera żadnej Chatynki. Sprawdź cyfry i spróbuj ponownie.')
        return
      }

      const result = discoverCottage(stored, cottage.slug, normalized, cottages.length)
      setStored(result.next)
      setCodeState('idle')
      setCodeMessage(result.isNew ? 'Nowa opowieść została odblokowana.' : 'Ta Chatynka jest już w Twojej Kronice. Otwieram opowieść ponownie.')
      setCodeDigits([...EMPTY_PIN])
      setStoryPreviouslyFound(!result.isNew)
      setStory(cottage)

      if (result.isNew) {
        const count = Object.keys(result.next.found).length
        track(`found-${cottage.slug}`, `Odkryto: ${cottage.title}`)
        track(`progress-${count}`, `Postęp: ${count}`)
        const foundAt = result.next.found[cottage.slug].foundAt
        void syncNewFind(cottage.slug, foundAt, count)
      }
      if (result.newlyEarned.length) {
        const latest = BADGES.find((badge) => badge.id === result.newlyEarned.at(-1))
        setAchievement(latest ? `Nowa odznaka: ${latest.name}` : '')
        window.setTimeout(() => setAchievement(''), 5000)
      }
    } catch {
      setCodeState('error')
      setCodeMessage('Nie udało się sprawdzić kodu. Sprawdź połączenie i spróbuj ponownie.')
    }
  }

  function navigateTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">Przejdź do treści</a>
      <SiteHeader items={[
        { label: 'Mapa wyprawy', onClick: () => navigateTo('mapa') },
        { label: 'Wpisz kod', onClick: openCode },
        { label: 'Notatnik', onClick: () => navigateTo('magia') },
        { label: 'Ranking', href: 'ranking.html' },
      ]} />

      <main id="main">
        <section className="expedition-board" id="top" aria-label="Plansza wyprawy">
          <div className="map-section" id="mapa">
            <div className="section-heading atlas-heading">
              <div>
                <p className="eyebrow"><MapTrifold size={16} weight="fill" /> Atlas Chatynkowa</p>
                <h2>{foundCount ? 'Wybierz kolejny trop' : 'Gdzie ruszysz najpierw?'}</h2>
              </div>
              <p>Dotknij znaku, poznaj wskazówkę i wyznacz swoją wyprawę w prawdziwym świecie.</p>
              <nav className="atlas-mobile-actions" aria-label="Szybkie akcje wyprawy">
                <button type="button" onClick={openCode}><Key size={19} weight="fill" /> Wpisz kod</button>
                <button type="button" onClick={() => setTreasuryOpen(true)}><Crown size={19} weight="fill" /> Kronika{foundCount > 0 && <strong>{foundCount}</strong>}</button>
              </nav>
            </div>
            {loadState === 'loading' && <div className="map-skeleton" role="status" aria-label="Ładowanie mapy"><div /><span>Rozwijam baśniową mapę...</span></div>}
            {loadState === 'error' && <div className="map-error" role="alert"><ShieldCheck size={34} /><h3>Mapa nie mogła się otworzyć</h3><p>Sprawdź połączenie i odśwież stronę. Twoje odkrycia są bezpieczne.</p><button className="button button-primary" type="button" onClick={() => window.location.reload()}>Odśwież</button></div>}
            {loadState === 'ready' && cottages.length === 0 && <div className="map-error"><MapTrifold size={34} /><h3>Kraina czeka na pierwszą Chatynkę</h3></div>}
            {loadState === 'ready' && cottages.length > 0 && (
              <Suspense fallback={<div className="map-skeleton"><div /><span>Rozwijam baśniową mapę...</span></div>}>
                <MapExplorer cottages={cottages} foundSlugs={foundSlugs} onOpenCode={openCode} />
              </Suspense>
            )}
          </div>

          <aside className="quest-panel" aria-label="Ekwipunek i cel wyprawy">
            <div className="quest-panel-head">
              <span>Etap {foundCount + 1} · Aktualne zadanie</span>
              <strong>{foundCount ? 'Odnajdź kolejną pieczęć' : 'Wybierz trop na mapie'}</strong>
              <p>{nextBadge ? `${nextBadge.name}: jeszcze ${discoveryCountLabel(discoveriesToNextBadge)}.` : 'Wszystkie opowieści odnalezione.'}</p>
              <button type="button" className="quest-progress-mini" onClick={() => setTreasuryOpen(true)}>
                <span><Crown size={15} weight="fill" /> Kronika</span>
                <strong>{foundCount} / {cottages.length || 26}</strong>
                <i aria-hidden="true"><b style={{ width: `${progressPercent}%` }} /></i>
              </button>
            </div>
            <div className="discovery-gate" id="kod" aria-labelledby="gate-title">
            <div className="gate-seal" aria-hidden="true"><LockKeyOpen size={28} weight="duotone" /></div>
            <p className="gate-kicker">Pieczęć Chatynki</p>
            <h2 id="gate-title">Jesteś na miejscu?</h2>
            <p className="gate-lead">Wpisz cztery cyfry z tabliczki i sprawdź, kogo udało Ci się odnaleźć.</p>
            <form className="code-form code-form--gate" onSubmit={submitCode} noValidate>
              <label id="code-label" htmlFor="discovery-code-0">Kod z tabliczki</label>
              <div
                className="pin-input"
                role="group"
                aria-labelledby="code-label"
                aria-describedby={codeMessage ? 'code-result' : undefined}
              >
                {codeDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(input) => { codeInputRefs.current[index] = input }}
                    id={`discovery-code-${index}`}
                    value={digit}
                    onChange={(event) => changePinDigit(index, event.currentTarget.value)}
                    onKeyDown={(event) => handlePinKeyDown(index, event)}
                    onPaste={(event) => handlePinPaste(index, event)}
                    onFocus={(event) => event.currentTarget.select()}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    pattern="[0-9]*"
                    maxLength={index === 0 ? 4 : 1}
                    enterKeyHint={index === 3 ? 'done' : 'next'}
                    aria-label={`Cyfra ${index + 1} z 4`}
                    aria-invalid={codeState === 'error'}
                    required
                  />
                ))}
              </div>
              <button className="button button-primary" type="submit" disabled={codeState === 'checking'}>
                {codeState === 'checking' ? 'Sprawdzam pieczęć...' : 'Otwórz opowieść'} <ArrowRight size={20} />
              </button>
              {codeMessage && <p id="code-result" className={`code-result ${codeState}`} role="status">{codeMessage}</p>}
            </form>
            </div>
            <button className="quest-kronika" type="button" onClick={() => setTreasuryOpen(true)}>
              <Crown size={22} weight="duotone" /><span><strong>Otwórz Kronikę</strong>Zobacz pieczęcie i odznaki</span><ArrowRight size={18} />
            </button>
            <div className="quest-notes" aria-label="Ważne informacje o wyprawie">
              <p><Footprints size={18} /> <span><strong>Wyprawa odbywa się w terenie</strong>Dbaj o las i trzymaj się bezpiecznych ścieżek.</span></p>
              <p><ShieldCheck size={18} weight="duotone" /> <span><strong>Postęp zapisuje się automatycznie</strong>Pieczęcie pozostaną na tym urządzeniu.</span></p>
            </div>
          </aside>
        </section>

        <section className="field-guide" id="magia">
          <div className="field-guide-intro">
            <p className="eyebrow"><BookOpenText size={16} weight="fill" /> Notatnik Tropiciela</p>
            <h2>Jeśli to Twoja pierwsza wyprawa</h2>
            <p>Nie musisz czytać instrukcji od deski do deski. Zapamiętaj cztery ruchy — resztę podpowie Ci Atlas i sam szlak.</p>
          </div>
          <ol className="field-guide-steps">
            <li><span>01</span><MapTrifold size={28} weight="duotone" /><strong>Wybierz znak</strong><p>Otwórz punkt w Atlasie i poznaj trop.</p></li>
            <li><span>02</span><Footprints size={28} weight="duotone" /><strong>Rusz w teren</strong><p>Chatynki czekają w prawdziwych miejscach Jury.</p></li>
            <li><span>03</span><Key size={28} weight="duotone" /><strong>Znajdź kod</strong><p>Cztery cyfry są na tabliczce przy Chatynce.</p></li>
            <li><span>04</span><BookOpenText size={28} weight="duotone" /><strong>Obudź historię</strong><p>Zapisz opowieść i pieczęć w Kronice.</p></li>
          </ol>
          <div className="field-guide-photo">
            <img src="assets/img/chatynkowo-trail.webp" alt="Leśny szlak prowadzący do rozświetlonej Chatynki" loading="lazy" decoding="async" />
            <blockquote>„Chatynki pokazują się tylko tym, którzy patrzą uważnie.”</blockquote>
          </div>
        </section>
      </main>

      <SiteFooter />

      {foundCount > 0 && (
        <button
          type="button"
          className="treasury-toggle"
          onClick={() => setTreasuryOpen(true)}
          aria-label={`Otwórz Kronikę. Zdobyte odznaki: ${Object.keys(stored.badges).length}`}
        >
          <Crown size={25} weight="fill" />
          <span>{Object.keys(stored.badges).length}</span>
        </button>
      )}


      {achievement && <div className="achievement-toast" role="status"><Crown size={21} weight="fill" />{achievement}</div>}

      {treasuryOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTreasuryOpen(false)}>
          <section className="modal-card treasury-modal" role="dialog" aria-modal="true" aria-labelledby="treasury-title">
            <button className="icon-button modal-close" type="button" onClick={() => setTreasuryOpen(false)} aria-label="Zamknij Kronikę"><X size={22} /></button>
            <Crown className="modal-emblem" size={42} weight="duotone" />
            <h2 id="treasury-title">Twoja Kronika</h2>
            <p>{foundCount ? `Kronika przechowuje ${foundCount} z ${cottages.length} opowieści.` : 'Jej karty są jeszcze puste. Pierwsza odnaleziona Chatynka zostawi tu swój ślad.'}</p>
            <div className="badge-grid">
              {BADGES.map((badge) => {
                const earned = Boolean(stored.badges[badge.id])
                return (
                  <article className={`badge-item${earned ? ' is-earned' : ''}`} key={badge.id}>
                    {earned ? <Trophy size={28} weight="fill" /> : <ShieldCheck size={28} />}
                    <div><h3>{badge.name}</h3><p>{badge.description}</p></div>
                  </article>
                )
              })}
            </div>
            {foundCount === cottages.length && cottages.length > 0 && <a className="button button-primary" href="ranking.html">Zobacz ranking</a>}
          </section>
        </div>
      )}

      {story && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setStory(null)}>
          <article className="modal-card story-modal" role="dialog" aria-modal="true" aria-labelledby="story-title">
            <button className="icon-button modal-close" type="button" onClick={() => setStory(null)} aria-label="Zamknij opowieść"><X size={22} /></button>
            <div className="story-photo"><img src={storyImage(story)} alt={`Leśna Chatynka, opowieść: ${story.title}`} /></div>
            <div className="story-body">
              <p className={`story-unlocked${storyPreviouslyFound ? ' is-returning' : ''}`}>
                <CheckCircle size={18} weight="fill" />
                {storyPreviouslyFound ? 'Chatynka odkryta wcześniej' : 'Nowa opowieść odblokowana'}
              </p>
              <h2 id="story-title">{story.title}</h2>
              {story.virtue && <p className="story-virtue">Mądrość tej historii: <strong>{story.virtue}</strong></p>}
              <div className="markdown" dangerouslySetInnerHTML={{ __html: marked.parse(story.storyMarkdown) as string }} />
              <div className="audio-card">
                <SpeakerHigh size={28} weight="duotone" />
                <div><strong>Posłuchaj baśni Elfa</strong><AudioPlayer src={`assets/stories/${story.slug}.mp3`} title={story.title} /></div>
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

export default App
