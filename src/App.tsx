import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  Crown,
  Footprints,
  HandHeart,
  HouseLine,
  Key,
  LockKeyOpen,
  MapTrifold,
  MoonStars,
  QrCode,
  ShieldCheck,
  Sparkle,
  SpeakerHigh,
  TreeEvergreen,
  Trophy,
  X,
} from '@phosphor-icons/react'
import { marked } from 'marked'
import { useTranslation } from 'react-i18next'
import { toLanguage } from './i18n'
import { loadCottages, resolveCode, storyAudio } from './lib/content'
import { backfillBadges, discoverCottage, loadStoredState } from './lib/persistence'
import { fallbackRewards, finalLevelId, loadRewards, requiredFinds } from './lib/rewards'
import { initializeAnalytics, track } from './lib/analytics'
import { syncNewFind } from './lib/sync'
import type { Cottage, RewardLevel, RewardsConfig, StoredState } from './types'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { AudioPlayer } from './components/AudioPlayer'
import { CottageGallery } from './components/CottageGallery'

/* Shared cottage photos: `thumb` (320x480, ~35 KB, sharp up to 3x displays)
   is all the gallery strip downloads; `full` loads only in the tapped-open
   lightbox and story dialog. */
const GALLERY_IMAGES = [
  {
    full: 'assets/img/WhatsApp-Image-2026-01-26-at-23.08.00-1.webp',
    thumb: 'assets/img/320x480/WhatsApp-Image-2026-01-26-at-23.08.00-1-320x480.webp',
  },
  {
    full: 'assets/img/683x1024/WhatsApp-Image-2026-01-26-at-23.08.04-1-683x1024.webp',
    thumb: 'assets/img/320x480/WhatsApp-Image-2026-01-26-at-23.08.04-1-320x480.webp',
  },
  {
    full: 'assets/img/WhatsApp-Image-2026-01-27-at-22.45.46.webp',
    thumb: 'assets/img/320x480/WhatsApp-Image-2026-01-27-at-22.45.46-320x480.webp',
  },
  {
    full: 'assets/img/683x1024/WhatsApp-Image-2026-01-27-at-22.51.33-683x1024.webp',
    thumb: 'assets/img/320x480/WhatsApp-Image-2026-01-27-at-22.51.33-320x480.webp',
  },
  {
    full: 'assets/img/WhatsApp-Image-2026-02-12-at-13.25.30.webp',
    thumb: 'assets/img/320x480/WhatsApp-Image-2026-02-12-at-13.25.30-320x480.webp',
  },
]

const STORY_IMAGES = GALLERY_IMAGES.map((image) => image.full)

const EMPTY_PIN = ['', '', '', '']

const MapExplorer = lazy(() =>
  import('./components/MapExplorer').then((module) => ({ default: module.MapExplorer })),
)

/* Photos uploaded for this cottage in /admin/, or — while none exist — one of
   the shared illustrations, picked from the slug so a cottage always shows the
   same one. */
function storyPhotos(cottage: Cottage) {
  if (cottage.photos?.length) {
    return cottage.photos.map((name) => `assets/img/cottages/${cottage.slug}/${name}`)
  }
  const index = Array.from(cottage.slug).reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return [STORY_IMAGES[index % STORY_IMAGES.length]]
}

function App() {
  const { t, i18n } = useTranslation()
  const language = toLanguage(i18n.resolvedLanguage)
  const [cottages, setCottages] = useState<Cottage[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [stored, setStored] = useState<StoredState>(() => loadStoredState())
  const [codeDigits, setCodeDigits] = useState<string[]>(() => [...EMPTY_PIN])
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'error'>('idle')
  const [codeMessageKey, setCodeMessageKey] = useState('')
  const [story, setStory] = useState<Cottage | null>(null)
  const [storyPreviouslyFound, setStoryPreviouslyFound] = useState(false)
  const [treasuryOpen, setTreasuryOpen] = useState(false)
  const [rewardDetail, setRewardDetail] = useState<RewardLevel | null>(null)
  const [rewards, setRewards] = useState<RewardsConfig>(fallbackRewards)
  const [achievement, setAchievement] = useState('')
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([])

  const codeMessage = codeMessageKey ? t(codeMessageKey) : ''
  const foundSlugs = useMemo(() => new Set(Object.keys(stored.found)), [stored.found])
  const foundCount = foundSlugs.size
  const progressPercent = cottages.length ? Math.round((foundCount / cottages.length) * 100) : 0
  const nextLevel = rewards.levels.find((level) => !stored.badges[level.id])
  const nextLevelTarget = (nextLevel && requiredFinds(nextLevel, cottages.length)) || cottages.length
  const discoveriesToNextLevel = Math.max(0, nextLevelTarget - foundCount)

  function rewardLockedHint(level: RewardLevel, total: number) {
    const required = requiredFinds(level, total)
    if (typeof required !== 'number' || required <= 0) return t('reward.lockedNone')
    return t('reward.lockedHint', { count: required })
  }

  /* Every level the seeker has a record of: the published ones, plus any level
     earned before it was renamed or removed in the editor, so collected
     progress is never hidden. */
  const kronikaLevels = useMemo<RewardLevel[]>(() => {
    const published = new Set(rewards.levels.map((level) => level.id))
    const orphans = Object.entries(stored.badges)
      .filter(([id]) => !published.has(id))
      .map(([id, meta]) => ({ id, name: meta.name || id, threshold: null, final: false, image: '', body: '' }))
    return [...rewards.levels, ...orphans]
  }, [rewards.levels, stored.badges])

  const completed = cottages.length > 0 && Boolean(stored.badges[finalLevelId(rewards.levels)])

  useEffect(() => {
    document.title = t('meta.homeTitle')
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.homeDescription'))
  }, [t])

  /* Stories and rewards are language-specific content, so they reload on every
     language change; the previous data stays on screen until the new one lands,
     which keeps the switch flicker-free. */
  useEffect(() => {
    let current = true
    loadCottages(language)
      .then((loaded) => {
        if (!current) return
        setCottages(loaded)
        setLoadState('ready')
      })
      .catch(() => {
        if (current) setLoadState('error')
      })
    void loadRewards(language).then((config) => {
      if (current) setRewards(config)
    })
    return () => {
      current = false
    }
  }, [language])

  useEffect(() => initializeAnalytics(), [])

  /* An open story dialog must follow a content reload — re-point it at the
     freshly loaded cottage with the same slug. */
  useEffect(() => {
    setStory((current) => current && (cottages.find((cottage) => cottage.slug === current.slug) ?? current))
  }, [cottages])

  /* Cottages and the reward config load independently, and both can change what
     is already earned (a new level, a lowered threshold). Reconcile once both
     are in, so a seeker never has to find one more Chatynka to see a reward
     they already qualify for. */
  useEffect(() => {
    if (!cottages.length) return
    const result = backfillBadges(stored, rewards.levels, cottages.length)
    if (result) setStored(result.next)
  }, [cottages.length, rewards.levels, stored])

  useEffect(() => {
    if (loadState === 'loading' || !window.location.hash) return
    const target = document.querySelector(window.location.hash)
    window.setTimeout(() => target?.scrollIntoView({ block: 'start' }), 80)
  }, [loadState])

  useEffect(() => {
    document.body.classList.toggle('modal-open', Boolean(story || treasuryOpen || rewardDetail))
    return () => document.body.classList.remove('modal-open')
  }, [story, treasuryOpen, rewardDetail])

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
      // The reward card sits on top of the Kronika — Escape peels off one layer.
      if (rewardDetail) {
        setRewardDetail(null)
        return
      }
      setStory(null)
      setTreasuryOpen(false)
    }
    document.addEventListener('keydown', closeModal)
    window.requestAnimationFrame(() => {
      // Focus the topmost card — with a reward open that is the detail, not the
      // Kronika grid still rendered underneath it.
      const cards = document.querySelectorAll<HTMLElement>('.modal-card .modal-close')
      cards[cards.length - 1]?.focus()
    })
    return () => {
      document.removeEventListener('keydown', closeModal)
      backgroundElements.forEach((element) => {
        element.inert = false
        element.removeAttribute('aria-hidden')
      })
      previousFocus?.focus()
    }
  }, [story, treasuryOpen, rewardDetail])

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
    if (codeMessageKey) setCodeMessageKey('')
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
      setCodeMessageKey('code.invalid')
      const firstEmpty = codeDigits.findIndex((digit) => !digit)
      codeInputRefs.current[firstEmpty < 0 ? 0 : firstEmpty]?.focus()
      return
    }

    setCodeState('checking')
    setCodeMessageKey('code.checking')
    try {
      const slug = await resolveCode(normalized)
      const cottage = cottages.find((item) => item.slug === slug)
      if (!cottage) {
        setCodeState('error')
        setCodeMessageKey('code.unknown')
        return
      }

      const result = discoverCottage(stored, cottage.slug, normalized, cottages.length, rewards.levels)
      setStored(result.next)
      setCodeState('idle')
      setCodeMessageKey(result.isNew ? 'code.unlocked' : 'code.alreadyFound')
      setCodeDigits([...EMPTY_PIN])
      setStoryPreviouslyFound(!result.isNew)
      setStory(cottage)

      if (result.isNew) {
        const count = Object.keys(result.next.found).length
        // Analytics labels stay Polish so both language versions of the site
        // aggregate into a single set of events.
        track(`found-${cottage.slug}`, `Odkryto: ${cottage.title}`)
        track(`progress-${count}`, `Postęp: ${count}`)
        const foundAt = result.next.found[cottage.slug].foundAt
        void syncNewFind(cottage.slug, foundAt, count)
      }
      if (result.newlyEarned.length) {
        const latest = rewards.levels.find((level) => level.id === result.newlyEarned.at(-1))
        setAchievement(latest ? t('achievement.newReward', { name: latest.name }) : '')
        window.setTimeout(() => setAchievement(''), 5000)
      }
    } catch {
      setCodeState('error')
      setCodeMessageKey('code.failed')
    }
  }

  function navigateTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">{t('common.skipToContent')}</a>
      <SiteHeader items={[
        { label: t('nav.map'), onClick: () => navigateTo('mapa') },
        { label: t('nav.enterCode'), onClick: openCode },
        { label: t('nav.about'), onClick: () => navigateTo('o-chatynkowie') },
        { label: t('nav.notebook'), onClick: () => navigateTo('magia') },
        { label: t('nav.ranking'), href: 'ranking.html' },
      ]} />

      <main id="main">
        <section className="expedition-board" id="top" aria-label={t('atlas.boardAria')}>
          <div className="map-section" id="mapa">
            <div className="section-heading atlas-heading">
              <div>
                <p className="eyebrow"><MapTrifold size={16} weight="fill" /> {t('atlas.eyebrow')}</p>
                <h2>{foundCount ? t('atlas.headingNext') : t('atlas.headingFirst')}</h2>
              </div>
              <p>{t('atlas.lead')}</p>
              <nav className="atlas-mobile-actions" aria-label={t('atlas.quickActionsAria')}>
                <button type="button" onClick={openCode}><Key size={19} weight="fill" /> {t('nav.enterCode')}</button>
                <button type="button" onClick={() => setTreasuryOpen(true)}><Crown size={19} weight="fill" /> {t('quest.chronicle')}{foundCount > 0 && <strong>{foundCount}</strong>}</button>
              </nav>
            </div>
            {loadState === 'loading' && <div className="map-skeleton" role="status" aria-label={t('atlas.loadingAria')}><div /><span>{t('atlas.loading')}</span></div>}
            {loadState === 'error' && <div className="map-error" role="alert"><ShieldCheck size={34} /><h3>{t('atlas.errorTitle')}</h3><p>{t('atlas.errorBody')}</p><button className="button button-primary" type="button" onClick={() => window.location.reload()}>{t('atlas.refresh')}</button></div>}
            {loadState === 'ready' && cottages.length === 0 && <div className="map-error"><MapTrifold size={34} /><h3>{t('atlas.emptyTitle')}</h3></div>}
            {loadState === 'ready' && cottages.length > 0 && (
              <Suspense fallback={<div className="map-skeleton"><div /><span>{t('atlas.loading')}</span></div>}>
                <MapExplorer cottages={cottages} foundSlugs={foundSlugs} onOpenCode={openCode} />
              </Suspense>
            )}
          </div>

          <aside className="quest-panel" aria-label={t('quest.panelAria')}>
            <div className="quest-panel-head">
              <span>{t('quest.stage', { stage: foundCount + 1 })}</span>
              <strong>{foundCount ? t('quest.taskNext') : t('quest.taskFirst')}</strong>
              <p>{nextLevel ? t('quest.nextLevel', { name: nextLevel.name, count: discoveriesToNextLevel }) : t('quest.allFound')}</p>
              <button type="button" className="quest-progress-mini" onClick={() => setTreasuryOpen(true)}>
                <span><Crown size={15} weight="fill" /> {t('quest.chronicle')}</span>
                <strong>{foundCount} / {cottages.length || 26}</strong>
                <i aria-hidden="true"><b style={{ width: `${progressPercent}%` }} /></i>
              </button>
            </div>
            <div className="discovery-gate" id="kod" aria-labelledby="gate-title">
            <div className="gate-seal" aria-hidden="true"><LockKeyOpen size={28} weight="duotone" /></div>
            <p className="gate-kicker">{t('quest.gateKicker')}</p>
            <h2 id="gate-title">{t('quest.gateTitle')}</h2>
            <p className="gate-lead">{t('quest.gateLead')}</p>
            <form className="code-form code-form--gate" onSubmit={submitCode} noValidate>
              <label id="code-label" htmlFor="discovery-code-0">{t('quest.codeLabel')}</label>
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
                    aria-label={t('quest.digitAria', { index: index + 1 })}
                    aria-invalid={codeState === 'error'}
                    required
                  />
                ))}
              </div>
              <button className="button button-primary" type="submit" disabled={codeState === 'checking'}>
                {codeState === 'checking' ? t('quest.checking') : t('quest.submit')} <ArrowRight size={20} />
              </button>
              {codeMessage && <p id="code-result" className={`code-result ${codeState}`} role="status">{codeMessage}</p>}
            </form>
            </div>
            <button className="quest-kronika" type="button" onClick={() => setTreasuryOpen(true)}>
              <Crown size={22} weight="duotone" /><span><strong>{t('quest.chronicleOpen')}</strong>{t('quest.chronicleOpenSub')}</span><ArrowRight size={18} />
            </button>
            <div className="quest-notes" aria-label={t('quest.notesAria')}>
              <p><Footprints size={18} /> <span><strong>{t('quest.note1Title')}</strong>{t('quest.note1Body')}</span></p>
              <p><ShieldCheck size={18} weight="duotone" /> <span><strong>{t('quest.note2Title')}</strong>{t('quest.note2Body')}</span></p>
            </div>
          </aside>
        </section>

        <section className="lore" id="o-chatynkowie" aria-label={t('lore.sectionAria')}>
          <div className="lore-board">
            <div className="lore-intro">
              <p className="eyebrow"><MoonStars size={16} weight="fill" /> {t('lore.eyebrow')}</p>
              <h2>{t('lore.title')}</h2>
              <p>{t('lore.intro1')}</p>
              <p>{t('lore.intro2')}</p>
            </div>
            <aside className="lore-creed">
              <HandHeart size={34} weight="duotone" />
              <blockquote>{t('lore.creedQuote')}</blockquote>
              <p>{t('lore.creedBody')}</p>
              <div className="lore-actions">
                <button className="button button-primary" type="button" onClick={() => navigateTo('mapa')}>
                  {t('lore.openAtlas')} <ArrowRight size={20} />
                </button>
                <button className="button button-ghost" type="button" onClick={() => navigateTo('magia')}>
                  {t('lore.howToStart')}
                </button>
              </div>
              <CottageGallery images={GALLERY_IMAGES} />
            </aside>
            <ul className="lore-cards">
              <li>
                <HouseLine size={30} weight="duotone" />
                <h3>{t('lore.cardWhatTitle')}</h3>
                <p>{t('lore.cardWhatBody')}</p>
              </li>
              <li>
                <Sparkle size={30} weight="duotone" />
                <h3>{t('lore.cardWhoTitle')}</h3>
                <p>{t('lore.cardWhoBody')}</p>
              </li>
              <li>
                <TreeEvergreen size={30} weight="duotone" />
                <h3>{t('lore.cardFindTitle')}</h3>
                <p>{t('lore.cardFindBody')}</p>
              </li>
              <li>
                <QrCode size={30} weight="duotone" />
                <h3>{t('lore.cardArriveTitle')}</h3>
                <p>{t('lore.cardArriveBody')}</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="field-guide" id="magia">
          <div className="field-guide-intro">
            <p className="eyebrow"><BookOpenText size={16} weight="fill" /> {t('guide.eyebrow')}</p>
            <h2>{t('guide.title')}</h2>
            <p>{t('guide.lead')}</p>
          </div>
          <ol className="field-guide-steps">
            <li><span>01</span><MapTrifold size={28} weight="duotone" /><strong>{t('guide.step1Title')}</strong><p>{t('guide.step1Body')}</p></li>
            <li><span>02</span><Footprints size={28} weight="duotone" /><strong>{t('guide.step2Title')}</strong><p>{t('guide.step2Body')}</p></li>
            <li><span>03</span><Key size={28} weight="duotone" /><strong>{t('guide.step3Title')}</strong><p>{t('guide.step3Body')}</p></li>
            <li><span>04</span><BookOpenText size={28} weight="duotone" /><strong>{t('guide.step4Title')}</strong><p>{t('guide.step4Body')}</p></li>
          </ol>
          <div className="field-guide-photo">
            <img src="assets/img/chatynkowo-trail.webp" alt={t('guide.photoAlt')} loading="lazy" decoding="async" />
            <blockquote>{t('guide.quote')}</blockquote>
          </div>
        </section>
      </main>

      <SiteFooter />

      {foundCount > 0 && (
        <button
          type="button"
          className="treasury-toggle"
          onClick={() => setTreasuryOpen(true)}
          aria-label={t('treasury.toggleAria', { count: Object.keys(stored.badges).length })}
        >
          <Crown size={25} weight="fill" />
          <span>{Object.keys(stored.badges).length}</span>
        </button>
      )}


      {achievement && <div className="achievement-toast" role="status"><Crown size={21} weight="fill" />{achievement}</div>}

      {treasuryOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTreasuryOpen(false)}>
          <section className="modal-card treasury-modal" role="dialog" aria-modal="true" aria-labelledby="treasury-title">
            <button className="icon-button modal-close" type="button" onClick={() => setTreasuryOpen(false)} aria-label={t('treasury.closeAria')}><X size={22} /></button>
            <Crown className="modal-emblem" size={42} weight="duotone" />
            <h2 id="treasury-title">{rewards.treasury.title}</h2>
            {rewards.treasury.intro
              ? <div className="markdown treasury-intro" dangerouslySetInnerHTML={{ __html: marked.parse(rewards.treasury.intro) as string }} />
              : <p>{foundCount ? t('treasury.fallbackProgress', { found: foundCount, total: cottages.length }) : t('treasury.fallbackEmpty')}</p>}
            <div className="badge-grid">
              {kronikaLevels.map((level) => {
                const earned = Boolean(stored.badges[level.id])
                return (
                  <button
                    type="button"
                    className={`badge-item${earned ? ' is-earned' : ''}`}
                    key={level.id}
                    onClick={() => setRewardDetail(level)}
                  >
                    <span className="badge-art">
                      {level.image
                        ? <img src={level.image} alt="" loading="lazy" decoding="async" />
                        : earned ? <Trophy size={28} weight="fill" /> : <ShieldCheck size={28} />}
                    </span>
                    <span className="badge-text">
                      <strong>{level.name}</strong>
                      <em>{earned ? t('treasury.badgeEarned') : t('treasury.badgeLocked')}</em>
                    </span>
                  </button>
                )
              })}
            </div>
            {completed && <a className="button button-primary" href="ranking.html">{t('treasury.seeRanking')}</a>}
          </section>
        </div>
      )}

      {rewardDetail && (
        <div className="modal-backdrop is-stacked" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setRewardDetail(null)}>
          <article className="modal-card reward-modal" role="dialog" aria-modal="true" aria-labelledby="reward-title">
            <button className="icon-button modal-close" type="button" onClick={() => setRewardDetail(null)} aria-label={t('reward.closeAria')}><X size={22} /></button>
            <h2 id="reward-title">{rewardDetail.name}</h2>
            {rewardDetail.image && <div className="reward-art"><img src={rewardDetail.image} alt={rewardDetail.name} decoding="async" /></div>}
            {stored.badges[rewardDetail.id]
              ? <p className="reward-status is-earned"><Trophy size={18} weight="fill" /> {t('reward.earned')}</p>
              : <p className="reward-status">{rewardLockedHint(rewardDetail, cottages.length)}</p>}
            {rewardDetail.body && <div className="markdown" dangerouslySetInnerHTML={{ __html: marked.parse(rewardDetail.body) as string }} />}
          </article>
        </div>
      )}

      {story && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setStory(null)}>
          <article className="modal-card story-modal" role="dialog" aria-modal="true" aria-labelledby="story-title">
            <button className="icon-button modal-close" type="button" onClick={() => setStory(null)} aria-label={t('story.closeAria')}><X size={22} /></button>
            <div className={`story-photo${storyPhotos(story).length > 1 ? ' is-gallery' : ''}`}>
              {storyPhotos(story).map((src) => (
                <img key={src} src={src} alt={t('story.photoAlt', { title: story.title })} loading="lazy" decoding="async" />
              ))}
            </div>
            <div className="story-body">
              <p className={`story-unlocked${storyPreviouslyFound ? ' is-returning' : ''}`} data-note={t('story.revisitNote')}>
                <CheckCircle size={18} weight="fill" />
                {storyPreviouslyFound ? t('story.foundBefore') : t('story.unlocked')}
              </p>
              <h2 id="story-title">{story.title}</h2>
              {story.virtue && <p className="story-virtue">{t('story.virtuePrefix')} <strong>{story.virtue}</strong></p>}
              <div className="audio-card">
                <SpeakerHigh size={28} weight="duotone" />
                <div><strong>{t('story.listen')}</strong><AudioPlayer {...storyAudio(story.slug, language)} title={story.title} /></div>
              </div>
              <div className="markdown" dangerouslySetInnerHTML={{ __html: marked.parse(story.storyMarkdown) as string }} />
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

export default App
