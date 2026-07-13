import type { Cottage, CottageLocation } from '../types'

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/

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
  const arrivalHeading = '## Co zrobić, gdy trafisz pod chatynkę?'
  const arrivalIndex = body.indexOf(arrivalHeading)
  if (arrivalIndex < 0) return { storyMarkdown: body, arrivalMarkdown: '' }

  return {
    storyMarkdown: body.slice(0, arrivalIndex).trim(),
    arrivalMarkdown: body.slice(arrivalIndex + arrivalHeading.length).trim(),
  }
}

async function loadCottage(location: CottageLocation): Promise<Cottage> {
  const response = await fetch(`cottages/${location.slug}.md`, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Nie udało się wczytać opowieści: ${location.slug}`)
  const raw = await response.text()
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

export async function loadCottages(): Promise<Cottage[]> {
  const response = await fetch('data/cottages.json', { cache: 'no-cache' })
  if (!response.ok) throw new Error('Nie udało się wczytać mapy Chatynkowa.')
  const locations = (await response.json()) as CottageLocation[]
  return Promise.all(locations.map(loadCottage))
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
