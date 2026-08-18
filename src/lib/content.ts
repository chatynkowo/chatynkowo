import type { Cottage, CottageLocation } from '../types'
import { DEFAULT_LANGUAGE, type Language } from '../i18n/registry'

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/

/* One entry per content language: the exact heading that separates the story
   from the arrival instructions in a cottage file. */
const ARRIVAL_HEADINGS = [
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

function splitMarkdown(raw: string) {
  const body = plainDash(raw.replace(FRONTMATTER, ''))
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

/* Polish files are the canonical originals at cottages/<slug>.md (that is what
   the admin editor writes); translations live in cottages/<language>/<slug>.md. */
function storyUrl(slug: string, language: Language) {
  return language === DEFAULT_LANGUAGE ? `cottages/${slug}.md` : `cottages/${language}/${slug}.md`
}

/* Recordings live in one directory per language —
   assets/stories/<language>/<slug>.mp3, with pl/ holding the originals.
   Static hosting offers no existence check, so the player receives the
   Polish URL as a fallback and drops to it when the language's own file
   turns out to be missing. */
export function storyAudio(slug: string, language: Language) {
  const src = `assets/stories/${language}/${slug}.mp3`
  return language === DEFAULT_LANGUAGE
    ? { src }
    : { src, fallbackSrc: `assets/stories/${DEFAULT_LANGUAGE}/${slug}.mp3` }
}

async function fetchStory(slug: string, language: Language) {
  const response = await fetch(storyUrl(slug, language), { cache: 'no-cache' })
  if (response.ok) return response.text()
  // A story without a translation yet falls back to the Polish original.
  if (language !== DEFAULT_LANGUAGE) {
    const fallback = await fetch(storyUrl(slug, DEFAULT_LANGUAGE), { cache: 'no-cache' })
    if (fallback.ok) return fallback.text()
  }
  throw new Error(`Nie udało się wczytać opowieści: ${slug}`)
}

async function loadCottage(location: CottageLocation, language: Language): Promise<Cottage> {
  const raw = await fetchStory(location.slug, language)
  const frontmatter = raw.match(FRONTMATTER)?.[1] ?? ''
  const markdown = splitMarkdown(raw)

  return {
    ...location,
    title: frontmatterValue(frontmatter, 'title') || location.slug,
    occupant: frontmatterValue(frontmatter, 'occupant'),
    virtue: frontmatterValue(frontmatter, 'virtue'),
    ...markdown,
  }
}

export async function loadCottages(language: Language = DEFAULT_LANGUAGE): Promise<Cottage[]> {
  const response = await fetch('data/cottages.json', { cache: 'no-cache' })
  if (!response.ok) throw new Error('Nie udało się wczytać mapy Chatynkowa.')
  const locations = (await response.json()) as CottageLocation[]
  return Promise.all(locations.map((location) => loadCottage(location, language)))
}

export async function resolveCode(code: string) {
  const response = await fetch('data/code_hashes.json', { cache: 'no-cache' })
  if (!response.ok) throw new Error('Nie udało się sprawdzić kodu. Spróbuj ponownie.')
  const lookup = (await response.json()) as { salt: string; entries: Record<string, string> }
  const value = new TextEncoder().encode(`${lookup.salt}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', value)
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return lookup.entries[hash] ?? null
}
