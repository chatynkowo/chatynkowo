import type { CodeLookup, Cottage, CottageLocation, RewardsConfig, StoryAudio } from './types'
import { DEFAULT_LANGUAGE, type Language } from './languages'
import { DEFAULT_COUNTRY } from './geo'
import { normalizeRewards, fallbackRewards } from './rewards'
import { defaultFetch, webCryptoSha256Hex, type FetchLike, type Sha256Hex } from './platform'

/* ------------------------------------------------------------------------
   Parsing — pure functions over the files the admin editor writes.
   ------------------------------------------------------------------------ */

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/

/* One entry per content language: the exact heading that separates the story
   from the arrival instructions in a cottage file. */
export const ARRIVAL_HEADINGS = [
  '## Co zrobić, gdy trafisz pod chatynkę?',
  '## What to do when you reach the cottage?',
]

function plainDash(value: string) {
  return value.replace(/[—–]/g, '-')
}

function frontmatterValue(frontmatter: string, key: string) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.+))$`, 'm'))
  return plainDash((match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim())
}

/* The body keeps its typographic dashes: a "– " at the start of a dialogue
   line must not become "- ", which markdown parses as a bullet list. */
function splitMarkdown(raw: string) {
  const body = raw.replace(FRONTMATTER, '')
    .replace(/^#\s+.*\n+/, '')
    .trim()
  for (const heading of ARRIVAL_HEADINGS) {
    const arrivalIndex = body.indexOf(heading)
    if (arrivalIndex >= 0) {
      return {
        storyMarkdown: body.slice(0, arrivalIndex).trim(),
        arrivalMarkdown: body.slice(arrivalIndex + heading.length).trim(),
      }
    }
  }
  return { storyMarkdown: body, arrivalMarkdown: '' }
}

export type ParsedStory = Pick<Cottage, 'title' | 'occupant' | 'virtue' | 'storyMarkdown' | 'arrivalMarkdown'>

/* A cottage markdown file -> its frontmatter fields and the two text parts.
   `title` falls back to the slug so a half-written file still lists. */
export function parseStoryFile(raw: string, slug: string): ParsedStory {
  const frontmatter = raw.match(FRONTMATTER)?.[1] ?? ''
  return {
    title: frontmatterValue(frontmatter, 'title') || slug,
    occupant: frontmatterValue(frontmatter, 'occupant'),
    virtue: frontmatterValue(frontmatter, 'virtue'),
    ...splitMarkdown(raw),
  }
}

/* ------------------------------------------------------------------------
   Paths — the published layout of the static site, shared by every client.
   ------------------------------------------------------------------------ */

export const CONTENT_PATHS = {
  locations: 'data/cottages.json',
  codeLookup: 'data/code_hashes.json',
  /* Polish files are the canonical originals at cottages/<slug>.md (that is
     what the admin editor writes); translations live in cottages/<lang>/. */
  story: (slug: string, language: Language) =>
    language === DEFAULT_LANGUAGE ? `cottages/${slug}.md` : `cottages/${language}/${slug}.md`,
  /* data/rewards.json is the canonical Polish config; a translation lives
     alongside it as data/rewards.<language>.json. */
  rewards: (language: Language) =>
    language === DEFAULT_LANGUAGE ? 'data/rewards.json' : `data/rewards.${language}.json`,
  /* Recordings live in one directory per language, pl/ holding the originals. */
  storyAudio: (slug: string, language: Language) => `assets/stories/${language}/${slug}.mp3`,
  cottagePhoto: (slug: string, name: string) => `assets/img/cottages/${slug}/${name}`,
} as const

/* ------------------------------------------------------------------------
   Plaque codes — salted SHA-256 lookup, the same algorithm as
   private/build-code-hashes.ts and the admin editor.
   ------------------------------------------------------------------------ */

export const CODE_PATTERN = /^\d{4}$/

export function isValidCode(code: string) {
  return CODE_PATTERN.test(code)
}

export function hashCode(salt: string, code: string, sha256Hex: Sha256Hex) {
  return sha256Hex(`${salt}:${code}`)
}

/* Offline-capable half of code resolution: a client that cached the lookup
   can validate without the network and sync the find later. */
export async function lookupCode(lookup: CodeLookup, code: string, sha256Hex: Sha256Hex) {
  const hash = await hashCode(lookup.salt, code, sha256Hex)
  return lookup.entries[hash] ?? null
}

/* ------------------------------------------------------------------------
   Content client — fetches the published files from wherever they are
   hosted. The web passes an empty baseUrl (relative paths, same origin); the
   mobile app passes the site's origin, e.g. https://www.chatynkowo.pl.
   ------------------------------------------------------------------------ */

export type ContentClientOptions = {
  /* Origin (plus optional path) the published content is served from. Empty
     string = paths relative to the current page. */
  baseUrl?: string
  fetch?: FetchLike
  /* SHA-256 hex used for plaque codes; defaults to WebCrypto, which React
     Native lacks — pass expo-crypto there. */
  sha256Hex?: Sha256Hex
}

export function createContentClient(options: ContentClientOptions = {}) {
  const base = (options.baseUrl ?? '').replace(/\/+$/, '')
  const fetchFn = options.fetch ?? defaultFetch()
  const sha256Hex = options.sha256Hex ?? webCryptoSha256Hex

  /* Site-relative path -> URL for this client. Also for the image paths found
     in data files (`photos`, reward `image`, `pin_custom_img`). */
  const url = (path: string) => (base ? `${base}/${path.replace(/^\/+/, '')}` : path)

  async function fetchText(path: string) {
    const response = await fetchFn(url(path), { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`)
    return response.text()
  }

  async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetchFn(url(path), { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`)
    return (await response.json()) as T
  }

  async function fetchStory(slug: string, language: Language) {
    try {
      return await fetchText(CONTENT_PATHS.story(slug, language))
    } catch (error) {
      // A story without a translation yet falls back to the Polish original.
      if (language === DEFAULT_LANGUAGE) throw error
      return fetchText(CONTENT_PATHS.story(slug, DEFAULT_LANGUAGE))
    }
  }

  async function loadCottage(location: CottageLocation, language: Language): Promise<Cottage> {
    let raw: string
    try {
      raw = await fetchStory(location.slug, language)
    } catch {
      throw new Error(`Could not load the story: ${location.slug}`)
    }
    return {
      ...location,
      country: location.country ?? DEFAULT_COUNTRY,
      ...parseStoryFile(raw, location.slug),
    }
  }

  /* Pins only — enough for the map and for counting the total. */
  async function loadLocations(): Promise<CottageLocation[]> {
    try {
      const data = await fetchJson<unknown>(CONTENT_PATHS.locations)
      return Array.isArray(data) ? (data as CottageLocation[]) : []
    } catch {
      throw new Error('Could not load the Chatynkowo map (data/cottages.json).')
    }
  }

  /* Pins plus every story in the given language (Polish as the fallback). */
  async function loadCottages(language: Language = DEFAULT_LANGUAGE): Promise<Cottage[]> {
    const locations = await loadLocations()
    return Promise.all(locations.map((location) => loadCottage(location, language)))
  }

  /* The Kronika config: the language's file, then the Polish one, then the
     built-in fallback — a half-filled or missing file never throws. */
  async function loadRewards(language: Language = DEFAULT_LANGUAGE): Promise<RewardsConfig> {
    const sources = language === DEFAULT_LANGUAGE
      ? [CONTENT_PATHS.rewards(language)]
      : [CONTENT_PATHS.rewards(language), CONTENT_PATHS.rewards(DEFAULT_LANGUAGE)]
    for (const path of sources) {
      try {
        const config = normalizeRewards(await fetchJson<unknown>(path))
        if (config.levels.length) return config
      } catch {
        // Try the next source; the static fallback is the last resort.
      }
    }
    return fallbackRewards
  }

  async function loadCodeLookup(): Promise<CodeLookup> {
    try {
      return await fetchJson<CodeLookup>(CONTENT_PATHS.codeLookup)
    } catch {
      throw new Error('Could not load the plaque-code lookup (data/code_hashes.json).')
    }
  }

  /* A four-digit plaque code -> the cottage slug it opens, or null. */
  async function resolveCode(code: string): Promise<string | null> {
    return lookupCode(await loadCodeLookup(), code, sha256Hex)
  }

  /* Static hosting offers no existence check, so a non-Polish language gets
     the Polish URL as a fallback for the player to drop to on load error. */
  function storyAudio(slug: string, language: Language = DEFAULT_LANGUAGE): StoryAudio {
    const src = url(CONTENT_PATHS.storyAudio(slug, language))
    return language === DEFAULT_LANGUAGE
      ? { src }
      : { src, fallbackSrc: url(CONTENT_PATHS.storyAudio(slug, DEFAULT_LANGUAGE)) }
  }

  function cottagePhotos(cottage: Pick<CottageLocation, 'slug' | 'photos'>): string[] {
    return (cottage.photos ?? []).map((name) => url(CONTENT_PATHS.cottagePhoto(cottage.slug, name)))
  }

  /* Plain functions, no `this`: safe to destructure or re-export. */
  return { url, loadLocations, loadCottages, loadRewards, loadCodeLookup, resolveCode, storyAudio, cottagePhotos }
}

export type ContentClient = ReturnType<typeof createContentClient>
