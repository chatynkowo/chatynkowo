import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  Crown,
  FacebookLogo,
  Footprints,
  InstagramLogo,
  Key,
  List,
  LockKeyOpen,
  MapTrifold,
  ShieldCheck,
  Sparkle,
  SpeakerHigh,
  Trophy,
  X,
} from '@phosphor-icons/react'
import { marked } from 'marked'
import { loadCottages, resolveCode } from './lib/content'
import { BADGES, discoverCottage, loadStoredState } from './lib/persistence'
import type { Cottage, StoredState } from './types'

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

function discoveredCottagesLabel(count: number) {
  if (count === 1) return '1 odkrytą Chatynkę'
  const lastTwo = count % 100
  const last = count % 10
  if ((lastTwo < 12 || lastTwo > 14) && last >= 2 && last <= 4) return `${count} odkryte Chatynki`
  return `${count} odkrytych Chatynek`
}

function loadExternalScript(src: string, module = false) {
  if (document.querySelector(`script[src="${src}"]`)) return
  const script = document.createElement('script')
  script.src = src
  script.async = true
  if (module) script.type = 'module'
  document.head.append(script)
}

function App() {
  const [cottages, setCottages] = useState<Cottage[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [stored, setStored] = useState<StoredState>(() => loadStoredState())
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [codeDigits, setCodeDigits] = useState<string[]>(() => [...EMPTY_PIN])
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'error'>('idle')
  const [codeMessage, setCodeMessage] = useState('')
  const [story, setStory] = useState<Cottage | null>(null)
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
    loadExternalScript('analytics.js')
    loadExternalScript('chatynkowo-sync.js', true)
    return () => {
      current = false
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
    document.getElementById('kod')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => codeInputRefs.current[0]?.focus(), 450)
  }, [])

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
      setCodeMessage('Opowieść została odblokowana.')
      setCodeDigits([...EMPTY_PIN])
      setStory(cottage)

      if (result.isNew) {
        const count = Object.keys(result.next.found).length
        window.chatynkowoStats?.track(`found-${cottage.slug}`, `Odkryto: ${cottage.title}`)
        window.chatynkowoStats?.track(`progress-${count}`, `Postęp: ${count}`)
        const foundAt = result.next.found[cottage.slug].foundAt
        void window.chatynkowoSync?.onFound(cottage.slug, foundAt, count)
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
    setMobileNavOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">Przejdź do treści</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Chatynkowo, strona główna">
          <img src="assets/img/logo.webp" alt="" />
          <span>Chatynkowo</span>
        </a>
        <nav className={`main-nav${mobileNavOpen ? ' is-open' : ''}`} aria-label="Główna nawigacja">
          <button type="button" onClick={() => navigateTo('magia')}>Jak grać</button>
          <button type="button" onClick={() => navigateTo('mapa')}>Atlas</button>
          <button type="button" onClick={openCode}>Wpisz kod</button>
          <a href="ranking.html">Ranking</a>
        </nav>
        <button
          type="button"
          className="nav-toggle icon-button"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? 'Zamknij menu' : 'Otwórz menu'}
        >
          {mobileNavOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </header>

      <main id="main">
        <section className={`hero${foundCount ? ' is-returning' : ' is-new'}`} id="top">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkle size={16} weight="fill" /> {foundCount ? 'Kronika rozpoznała Twój ślad' : 'Baśniowa gra terenowa w Jurze'}</p>
            <h1>{foundCount ? 'Witaj ponownie, Tropicielu' : 'Chatynkowo czeka na Twój pierwszy krok'}</h1>
            <p className="hero-lead">
              {foundCount
                ? `Masz już ${discoveredCottagesLabel(foundCount)}. Wybierz kolejny trop albo obudź opowieść kodem z tabliczki.`
                : 'W prawdziwych lasach i skałach Jury ukryto domy Elfów. Odszukaj je, zdobywaj pieczęcie i otwieraj opowieści, których nie da się poznać z domu.'}
            </p>
            <div className="hero-actions">
              <button className="button button-primary" type="button" onClick={() => navigateTo('mapa')}>
                <MapTrifold size={21} weight="fill" /> {foundCount ? 'Kontynuuj wyprawę' : 'Rozpocznij wyprawę'}
              </button>
              <button className="button button-ghost" type="button" onClick={() => foundCount ? setTreasuryOpen(true) : navigateTo('magia')}>
                {foundCount ? <Crown size={21} /> : <BookOpenText size={21} />}
                {foundCount ? 'Otwórz Kronikę' : 'Poznaj zasady'}
              </button>
            </div>
            <p className="hero-world-note"><Footprints size={18} weight="duotone" /> Gra toczy się na prawdziwym szlaku. Dbaj o las i nie schodź z bezpiecznych ścieżek.</p>
          </div>

          <aside className="discovery-gate" id="kod" aria-labelledby="gate-title">
            <div className="gate-seal" aria-hidden="true"><LockKeyOpen size={28} weight="duotone" /></div>
            <p className="gate-kicker">Pieczęć Chatynki</p>
            <h2 id="gate-title">{foundCount ? 'Obudź kolejną opowieść' : 'Stoisz przy Chatynce?'}</h2>
            <p className="gate-lead">Wpisz cztery cyfry z tabliczki. Jeśli pieczęć jest prawdziwa, Elf otworzy przed Tobą swoją historię.</p>
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
            <p className="gate-memory"><ShieldCheck size={17} weight="duotone" /> Twój ślad i odkrycia zapiszą się na tym urządzeniu.</p>
          </aside>

          <div className="hero-progress" aria-label={`Odkryto ${foundCount} z ${cottages.length || 26} Chatynek`}>
            <div className="quest-progress-copy">
              <span>Twoja Kronika</span>
              <strong>{foundCount ? `${foundCount} z ${cottages.length || 26} pieczęci` : 'Jeszcze nie rozpoczęta'}</strong>
            </div>
            <div className="quest-progress-track" aria-hidden="true"><i style={{ width: `${progressPercent}%` }} /></div>
            <div className="quest-next-goal">
              <span>{nextBadge ? 'Następny cel' : 'Kronika ukończona'}</span>
              <strong>{nextBadge ? `${nextBadge.name} · ${discoveryCountLabel(discoveriesToNextBadge)}` : 'Wszystkie opowieści odnalezione'}</strong>
            </div>
          </div>
        </section>

        <section className="magic-section" id="magia">
          <figure className="magic-image-wrap">
            <img src="assets/img/chatynkowo-trail.webp" alt="Leśny szlak prowadzący do rozświetlonej Chatynki" loading="lazy" decoding="async" />
            <figcaption>„Chatynki pokazują się tylko tym, którzy patrzą uważnie.”</figcaption>
          </figure>
          <div className="magic-copy">
            <p className="eyebrow"><BookOpenText size={16} weight="fill" /> Zasady krainy</p>
            <h2>26 domów. 26 opowieści. Jeden prawdziwy szlak.</h2>
            <p>To nie jest gra do przejścia przed ekranem. Atlas prowadzi do prawdziwych miejsc, a każda odnaleziona Chatynka zostawia ślad w Twojej Kronice.</p>
            <ol className="journey-steps">
              <li><MapTrifold size={26} weight="duotone" /><span><strong>Wybierz trop w Atlasie</strong>Mapa wskaże prawdziwe miejsce ukrycia.</span></li>
              <li><Footprints size={26} weight="duotone" /><span><strong>Dotrzyj na miejsce</strong>Idź uważnie i pozwól, by to las podpowiadał drogę.</span></li>
              <li><Key size={26} weight="duotone" /><span><strong>Odszukaj pieczęć</strong>Cztery cyfry znajdziesz dopiero przy Chatynce.</span></li>
              <li><BookOpenText size={26} weight="duotone" /><span><strong>Obudź opowieść</strong>Głos Elfa i zdobyta pieczęć zostaną w Twojej Kronice.</span></li>
            </ol>
          </div>
        </section>

        <section className="map-section" id="mapa">
          <div className="section-heading">
            <p className="eyebrow"><MapTrifold size={16} weight="fill" /> Atlas Chatynkowa</p>
            <h2>{foundCount ? 'Dokąd prowadzi następny trop?' : 'Wybierz pierwszą Chatynkę'}</h2>
            <p>Każdy znak prowadzi do miejsca istniejącego naprawdę. Wybierz Chatynkę, poznaj wskazówkę i ruszaj w drogę.</p>
          </div>
          {loadState === 'loading' && (
            <div className="map-skeleton" role="status" aria-label="Ładowanie mapy">
              <div /><span>Rozwijam baśniową mapę...</span>
            </div>
          )}
          {loadState === 'error' && (
            <div className="map-error" role="alert">
              <ShieldCheck size={34} />
              <h3>Mapa nie mogła się otworzyć</h3>
              <p>Sprawdź połączenie i odśwież stronę. Twoje dotychczasowe odkrycia są bezpieczne w tym urządzeniu.</p>
              <button className="button button-primary" type="button" onClick={() => window.location.reload()}>Odśwież</button>
            </div>
          )}
          {loadState === 'ready' && cottages.length === 0 && (
            <div className="map-error"><MapTrifold size={34} /><h3>Kraina czeka na pierwszą Chatynkę</h3><p>Dodaj punkt w edytorze, aby pojawił się na mapie.</p></div>
          )}
          {loadState === 'ready' && cottages.length > 0 && (
            <Suspense fallback={<div className="map-skeleton"><div /><span>Rozwijam baśniową mapę...</span></div>}>
              <MapExplorer cottages={cottages} foundSlugs={foundSlugs} onOpenCode={openCode} />
            </Suspense>
          )}
        </section>

        <section className="treasury-banner">
          <div className="treasury-copy">
            <p className="eyebrow"><Crown size={16} weight="fill" /> Kronika Tropiciela</p>
            <h2>{foundCount ? 'Twój ślad w Chatynkowie rośnie' : 'Pierwsza karta wciąż jest pusta'}</h2>
            <p>{foundCount ? `Odnalezione opowieści: ${foundCount}. Zdobyte odznaki: ${Object.keys(stored.badges).length}.` : 'Odnajdź pierwszą Chatynkę, a Kronika zapamięta jej opowieść i przyzna Ci pierwszą pieczęć.'}</p>
          </div>
          <div className="treasury-stats" aria-label="Postęp wyprawy">
            <span><strong>{foundCount}</strong> odkryć</span>
            <span><strong>{Object.keys(stored.badges).length}</strong> odznak</span>
            <span><strong>{cottages.length || 26}</strong> opowieści</span>
          </div>
          <div className="treasury-actions">
            <button className="button button-primary" type="button" onClick={() => setTreasuryOpen(true)}>Otwórz Kronikę</button>
            <a className="button button-ghost" href="ranking.html">Ranking Tropicieli</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-brand" href="#top"><img src="assets/img/logo.webp" alt="" /><span>Chatynkowo</span></a>
        <nav aria-label="Dokumenty">
          <a href="legal/regulamin.html">Regulamin</a>
          <a href="legal/polityka-prywatnosci.html">Polityka prywatności</a>
        </nav>
        <nav aria-label="Media społecznościowe">
          <a href="https://www.instagram.com/chatynkowo.pl/" rel="noreferrer" target="_blank"><InstagramLogo size={20} /> Instagram</a>
          <a href="https://www.facebook.com/chatynkowo/" rel="noreferrer" target="_blank"><FacebookLogo size={20} /> Facebook</a>
        </nav>
      </footer>

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
              <p className="story-unlocked"><CheckCircle size={18} weight="fill" /> Opowieść odblokowana</p>
              <h2 id="story-title">{story.title}</h2>
              {story.virtue && <p className="story-virtue">Mądrość tej historii: <strong>{story.virtue}</strong></p>}
              <div className="markdown" dangerouslySetInnerHTML={{ __html: marked.parse(story.storyMarkdown) as string }} />
              <div className="audio-card">
                <SpeakerHigh size={28} weight="duotone" />
                <div><strong>Posłuchaj baśni Elfa</strong><audio src={`assets/stories/${story.slug}.mp3`} controls preload="none" /></div>
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

export default App
