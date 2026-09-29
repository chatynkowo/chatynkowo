import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CACHE_MAX_AGE_MS, fallbackRewards, isFresh, type CodeLookup, type Cottage, type RewardsConfig } from '@chatynkowo/core'
import { toLanguage, type Language } from '../i18n'
import type { BootResult } from '../lib/bootstrap'
import { content, contentUrl, loadCodeLookupCached, loadCottagesCached, loadRewardsCached, type CachedEntries } from '../lib/content'
import { prefetchContent } from '../ui'
import { useForeground, useOnline, useReconnect } from './NetworkProvider'

/* The published content in the current language: cottages with their
   stories, the reward config and the code lookup, served from the offline
   cache first and refreshed in the background. The first render already
   holds what bootstrap() read from the cache, so a later launch never
   flashes an empty Atlas. Screens read from here and never fetch on their
   own; connectivity is read through useOnline() so a network flap does not
   re-render every consumer. */

export type ContentStatus = 'loading' | 'ready' | 'error'

export type ContentValue = {
  language: Language
  cottages: Cottage[]
  rewards: RewardsConfig
  lookup: CodeLookup | null
  /* The code lookup on its own: the code sheet holds a typed code while it
     is loading and offers a retry when it failed. */
  lookupStatus: ContentStatus
  /* Number of published cottages: the ranking's denominator and the final
     reward's threshold. */
  total: number
  status: ContentStatus
  /* The first resolution is done (cache, network or error). */
  settled: boolean
  /* The cottages on screen came from the cache and are older than their max
     age; a refresh is under way if the network allows it. */
  stale: boolean
  /* `force` skips the freshness check (pull to refresh). */
  refresh: (options?: { force?: boolean }) => Promise<void>
  refreshLookup: () => Promise<void>
  cottageBySlug: (slug: string) => Cottage | undefined
  /* Warms the image cache with the photos of the given cottages; the
     progress provider passes the found ones. */
  prefetchStoryPhotos: (slugs: Iterable<string>) => void
}

type Kind = 'cottages' | 'rewards' | 'lookup'

const ALL_KINDS: Kind[] = ['cottages', 'rewards', 'lookup']
const NO_ENTRIES: CachedEntries = { cottages: null, rewards: null, lookup: null }
const FOREGROUND_MIN_INTERVAL_MS = 60_000

const ContentContext = createContext<ContentValue | null>(null)

/* Image warming is a convenience; it must never surface an error. */
function warmImages(uris: string[]) {
  if (!uris.length) return
  try {
    void Promise.resolve()
      .then(() => prefetchContent(uris))
      .catch(() => {})
  } catch {
    // The stub or the native module is unavailable: images load on demand.
  }
}

export function ContentProvider({ initial, children }: { initial: BootResult; children: ReactNode }) {
  const { i18n } = useTranslation()
  const language = toLanguage(i18n.resolvedLanguage ?? i18n.language)
  const online = useOnline()

  /* The boot entries belong to the boot language; a language restored after
     the deadline starts from nothing and loads below. Read once. */
  const boot = useRef(initial.language === language ? initial.content : NO_ENTRIES).current
  const [cottages, setCottages] = useState<Cottage[]>(() => boot.cottages?.value ?? [])
  const [rewards, setRewards] = useState<RewardsConfig>(() => boot.rewards?.value ?? fallbackRewards)
  const [lookup, setLookup] = useState<CodeLookup | null>(() => boot.lookup?.value ?? null)
  const [status, setStatus] = useState<ContentStatus>(boot.cottages ? 'ready' : 'loading')
  const [lookupStatus, setLookupStatus] = useState<ContentStatus>(boot.lookup ? 'ready' : 'loading')
  const [settled, setSettled] = useState(Boolean(boot.cottages))
  const [stale, setStale] = useState(() => Boolean(boot.cottages) && !isFresh(boot.cottages, CACHE_MAX_AGE_MS.stories))

  /* Latest values for the loaders, which are subscribed once. */
  const languageRef = useRef(language)
  const onlineRef = useRef(online)
  const mounted = useRef(true)
  useEffect(() => {
    onlineRef.current = online
  }, [online])
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  /* What the retries (reconnect, foreground) have to redo: loaders that
     rejected and entries served stale whose background refresh never came. */
  const failed = useRef(new Set<Kind>())
  const staleKinds = useRef(new Set<Kind>())

  const run = useCallback(async (kinds: Kind[], force = false) => {
    const lang = languageRef.current
    const offline = onlineRef.current === false
    /* A language switch mid-flight abandons the old language's results. */
    const alive = () => mounted.current && languageRef.current === lang
    const track = (kind: Kind, isStale: boolean) => {
      if (isStale) staleKinds.current.add(kind)
      else staleKinds.current.delete(kind)
    }
    const jobs: Promise<void>[] = []

    if (kinds.includes('cottages')) {
      jobs.push(
        loadCottagesCached(lang, {
          offline,
          force,
          revalidate: (fresh) => {
            if (!alive()) return
            setCottages(fresh)
            setStale(false)
            track('cottages', false)
          },
        })
          .then((result) => {
            if (!alive()) return
            failed.current.delete('cottages')
            track('cottages', result.stale)
            setCottages(result.value)
            setStale(result.stale)
            setStatus('ready')
          })
          .catch(() => {
            if (!alive()) return
            failed.current.add('cottages')
            /* Nothing to show for this language: an error state. Content
               already on screen (previous language, earlier load) stays. */
            setStatus((current) => (current === 'ready' ? current : 'error'))
          })
          .finally(() => {
            if (alive()) setSettled(true)
          }),
      )
    }

    if (kinds.includes('rewards')) {
      jobs.push(
        loadRewardsCached(lang, {
          offline,
          force,
          revalidate: (fresh) => {
            if (!alive()) return
            setRewards(fresh)
            track('rewards', false)
          },
        })
          .then((result) => {
            if (!alive()) return
            failed.current.delete('rewards')
            track('rewards', result.stale)
            setRewards(result.value)
          })
          .catch(() => {
            if (alive()) failed.current.add('rewards')
          }),
      )
    }

    if (kinds.includes('lookup')) {
      /* The lookup is the same for every language, so it outlives a switch. */
      jobs.push(
        loadCodeLookupCached({
          offline,
          force,
          revalidate: (fresh) => {
            if (!mounted.current) return
            setLookup(fresh)
            track('lookup', false)
          },
        })
          .then((result) => {
            if (!mounted.current) return
            failed.current.delete('lookup')
            track('lookup', result.stale)
            setLookup(result.value)
            setLookupStatus('ready')
          })
          .catch(() => {
            if (!mounted.current) return
            failed.current.add('lookup')
            setLookupStatus((current) => (current === 'ready' ? current : 'error'))
          }),
      )
    }

    await Promise.all(jobs)
  }, [])

  /* Stories and rewards are language-specific, so they reload on every
     language change; the previous data stays on screen until the new one
     lands, which keeps the switch flicker-free. On the boot language the
     entries the splash already read are only revalidated when stale. */
  const firstRun = useRef(true)
  useEffect(() => {
    languageRef.current = language
    failed.current.clear()
    staleKinds.current.clear()
    const fromBoot = firstRun.current && initial.language === language
    firstRun.current = false
    const freshAtBoot = (kind: Kind) =>
      kind === 'cottages'
        ? isFresh(boot.cottages, CACHE_MAX_AGE_MS.stories)
        : kind === 'rewards'
          ? isFresh(boot.rewards, CACHE_MAX_AGE_MS.rewards)
          : isFresh(boot.lookup, CACHE_MAX_AGE_MS.codeLookup)
    const kinds = fromBoot ? ALL_KINDS.filter((kind) => !freshAtBoot(kind)) : ALL_KINDS
    if (kinds.length) void run(kinds)
  }, [language, initial.language, boot, run])

  /* Back online or back in the foreground: retry what failed and revalidate
     what is stale; nothing else moves. */
  const retry = useCallback(() => {
    const kinds = ALL_KINDS.filter((kind) => failed.current.has(kind) || staleKinds.current.has(kind))
    if (kinds.length) void run(kinds)
  }, [run])
  useReconnect(retry)
  useForeground(retry, { minIntervalMs: FOREGROUND_MIN_INTERVAL_MS })

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      setStatus((current) => (current === 'error' ? 'loading' : current))
      setLookupStatus((current) => (current === 'error' ? 'loading' : current))
      await run(ALL_KINDS, Boolean(options?.force))
    },
    [run],
  )

  const refreshLookup = useCallback(async () => {
    setLookupStatus((current) => (current === 'error' ? 'loading' : current))
    await run(['lookup'], true)
  }, [run])

  /* Reward art is small and shown on the Kronika, the celebration and the
     reward sheet; warm it as soon as the config lands. */
  useEffect(() => {
    warmImages(rewards.levels.map((level) => level.image).filter(Boolean).map((path) => contentUrl(path)))
  }, [rewards.levels])

  const bySlug = useMemo(() => new Map(cottages.map((cottage) => [cottage.slug, cottage])), [cottages])
  const cottageBySlug = useCallback((slug: string) => bySlug.get(slug), [bySlug])

  const warmedPhotos = useRef(new Set<string>())
  const prefetchStoryPhotos = useCallback(
    (slugs: Iterable<string>) => {
      const uris: string[] = []
      for (const slug of slugs) {
        const cottage = bySlug.get(slug)
        if (!cottage || warmedPhotos.current.has(slug)) continue
        warmedPhotos.current.add(slug)
        uris.push(...content.storyPhotos(cottage))
      }
      warmImages(uris)
    },
    [bySlug],
  )

  const value = useMemo<ContentValue>(
    () => ({
      language,
      cottages,
      rewards,
      lookup,
      lookupStatus,
      total: cottages.length,
      status,
      settled,
      stale,
      refresh,
      refreshLookup,
      cottageBySlug,
      prefetchStoryPhotos,
    }),
    [language, cottages, rewards, lookup, lookupStatus, status, settled, stale, refresh, refreshLookup, cottageBySlug, prefetchStoryPhotos],
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent() {
  const value = useContext(ContentContext)
  if (!value) throw new Error('useContent must be used inside ContentProvider.')
  return value
}
