import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { fallbackRewards, type CodeLookup, type Cottage, type RewardsConfig } from '@chatynkowo/core'
import { toLanguage, type Language } from '../i18n'
import { loadCodeLookupCached, loadCottagesCached, loadRewardsCached } from '../lib/content'
import { useOnline } from '../lib/network'

/* The published content in the current language: cottages with their
   stories, the reward config and the code lookup, served from the offline
   cache first and refreshed in the background. Screens read from here and
   never fetch on their own. */

export type ContentStatus = 'loading' | 'ready' | 'error'

type ContentValue = {
  language: Language
  cottages: Cottage[]
  rewards: RewardsConfig
  lookup: CodeLookup | null
  /* Number of published cottages — the ranking's denominator and the final
     reward's threshold. */
  total: number
  status: ContentStatus
  /* The device reports no connection. */
  offline: boolean
  /* The cottages on screen came from the cache and are older than their max
     age; a refresh is under way if the network allows it. */
  stale: boolean
  refresh: () => Promise<void>
  cottageBySlug: (slug: string) => Cottage | undefined
}

const ContentContext = createContext<ContentValue | null>(null)

export function ContentProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const language = toLanguage(i18n.resolvedLanguage ?? i18n.language)
  const online = useOnline()
  const offline = online === false
  const [cottages, setCottages] = useState<Cottage[]>([])
  const [rewards, setRewards] = useState<RewardsConfig>(fallbackRewards)
  const [lookup, setLookup] = useState<CodeLookup | null>(null)
  const [status, setStatus] = useState<ContentStatus>('loading')
  const [stale, setStale] = useState(false)
  const [generation, setGeneration] = useState(0)

  /* Stories and rewards are language-specific, so they reload on every
     language change; the previous data stays on screen until the new one
     lands, which keeps the switch flicker-free. */
  useEffect(() => {
    let current = true
    const options = { offline }
    void loadCottagesCached(language, {
      ...options,
      revalidate: (fresh) => {
        if (!current) return
        setCottages(fresh)
        setStale(false)
      },
    })
      .then((result) => {
        if (!current) return
        setCottages(result.value)
        setStale(result.stale)
        setStatus('ready')
      })
      .catch(() => {
        if (current) setStatus('error')
      })
    void loadRewardsCached(language, { ...options, revalidate: (fresh) => current && setRewards(fresh) }).then((result) => {
      if (current) setRewards(result.value)
    })
    void loadCodeLookupCached({ ...options, revalidate: (fresh) => current && setLookup(fresh) })
      .then((result) => {
        if (current) setLookup(result.value)
      })
      .catch(() => {
        // Codes cannot be validated until the lookup arrives; the Code screen says so.
      })
    return () => {
      current = false
    }
    // `offline` is deliberately not a dependency: coming back online must not
    // restart a load that is already showing data — `refresh` does that.
  }, [language, generation])

  const refresh = useCallback(async () => {
    setStatus((current) => (current === 'error' ? 'loading' : current))
    setGeneration((value) => value + 1)
  }, [])

  const bySlug = useMemo(() => new Map(cottages.map((cottage) => [cottage.slug, cottage])), [cottages])
  const cottageBySlug = useCallback((slug: string) => bySlug.get(slug), [bySlug])

  const value = useMemo<ContentValue>(
    () => ({ language, cottages, rewards, lookup, total: cottages.length, status, offline, stale, refresh, cottageBySlug }),
    [language, cottages, rewards, lookup, status, offline, stale, refresh, cottageBySlug],
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent() {
  const value = useContext(ContentContext)
  if (!value) throw new Error('useContent must be used inside ContentProvider.')
  return value
}
