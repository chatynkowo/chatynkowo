import type { RewardLevel, RewardsConfig } from '../types'
import { DEFAULT_LANGUAGE, type Language } from '../i18n/registry'

/* The Kronika (Skarbiec) is data-driven: its intro text and every reward level
   live in data/rewards.json, authored in /admin/ → Nagrody. This module is the
   single place that reads that file, so the app never has to care whether the
   config came from the repository or from the fallback below. */

/* Used only when data/rewards.json cannot be loaded (older deploy, offline).
   The ids match the seeded config, so badges already earned and stored by id
   keep matching whichever source is in effect. */
const FALLBACK: RewardsConfig = {
  treasury: {
    title: 'Twoja Kronika',
    intro: 'Tu zbierają się pieczęcie i odznaki zdobyte podczas wyprawy.',
    image: '',
  },
  levels: [
    { id: 'first-find', name: 'Pierwsza Chatynka', threshold: 1, final: false, image: '', body: 'Pierwsza opowieść została odkryta.' },
    { id: 'tropiciel', name: 'Tropiciel', threshold: 5, final: false, image: '', body: 'Pięć Chatynek odnalezionych.' },
    { id: 'polowa-drogi', name: 'Połowa drogi', threshold: 13, final: false, image: '', body: 'Połowa wyprawy jest już za Tobą.' },
    { id: 'mistrz-chatynkowa', name: 'Mistrz Chatynkowa', threshold: null, final: true, image: '', body: 'Wszystkie Chatynki zostały odkryte.' },
  ],
}

export const fallbackRewards = FALLBACK

/* Tolerate missing keys so a half-filled file never throws — the editor can
   legitimately publish a level before its image or description exist. */
function normalize(raw: unknown): RewardsConfig {
  const source = (raw ?? {}) as Partial<RewardsConfig>
  const treasury = source.treasury ?? ({} as Partial<RewardsConfig['treasury']>)
  const levels = Array.isArray(source.levels) ? source.levels : []

  return {
    treasury: {
      title: treasury.title || FALLBACK.treasury.title,
      intro: treasury.intro || '',
      image: treasury.image || '',
    },
    levels: levels
      .filter((level): level is RewardLevel => Boolean(level && level.id))
      .map((level) => ({
        id: String(level.id),
        name: level.name || String(level.id),
        threshold: level.threshold == null ? null : Number(level.threshold),
        final: Boolean(level.final),
        image: level.image || '',
        body: level.body || '',
      })),
  }
}

/* data/rewards.json is the canonical Polish config written by the editor;
   a translation lives alongside it as data/rewards.<language>.json and the
   Polish file remains the fallback when one does not exist. */
export async function loadRewards(language: Language = DEFAULT_LANGUAGE): Promise<RewardsConfig> {
  const sources = language === DEFAULT_LANGUAGE
    ? ['data/rewards.json']
    : [`data/rewards.${language}.json`, 'data/rewards.json']
  for (const url of sources) {
    try {
      const response = await fetch(url, { cache: 'no-cache' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const config = normalize(await response.json())
      if (config.levels.length) return config
    } catch {
      // Try the next source; the static FALLBACK is the last resort.
    }
  }
  return FALLBACK
}

/* How many discoveries unlock a level — `total` for the final one, so renaming
   or reordering levels in the editor never hardcodes the cottage count. */
export function requiredFinds(level: RewardLevel, total: number) {
  return level.final ? total : level.threshold
}

/* Id of the full-set level, which also unlocks the ranking invite. Read from
   the config so the editor may rename it freely. */
export function finalLevelId(levels: RewardLevel[]) {
  return levels.find((level) => level.final)?.id ?? 'mistrz-chatynkowa'
}
