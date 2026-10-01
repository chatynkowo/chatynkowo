import { emptyProgress, emptyQueue, type StoredState, type SyncQueue } from '@chatynkowo/core'
import { STORAGE_KEYS } from '../config'
import i18n, { restoreLanguage, toLanguage, type Language } from '../i18n'
import { readCachedEntries, type CachedEntries } from './content'
import { loadProgress, loadQueue } from './progress-store'
import { readJson } from './storage'

/* Everything the first frame needs, read from the device behind the native
   splash: the remembered language, the seeker's progress and sync queue,
   whether the welcome was seen, the rewards already viewed and the cached
   content. The content entries and the flags are raced against one deadline
   so a slow storage cannot hold the splash for long; whatever misses it
   falls back to an empty value and the providers load it the normal way.
   The progress and the queue are never raced: an empty fallback would be
   saved over the real Kronika by the next discovery, so the splash simply
   waits for those two small reads, and a read that fails outright is
   reported through `storageOk` so nothing is written until one succeeds. */

export type BootResult = {
  welcomeSeen: boolean
  progress: StoredState
  queue: SyncQueue
  /* Reward ids already viewed in the Kronika; unseen = earned minus these. */
  rewardsSeen: string[]
  content: CachedEntries
  language: Language
  /* False when the progress or the queue could not be read at all (not
     merely absent): the provider then keeps writes off until a read works. */
  storageOk: boolean
}

const BOOT_TIMEOUT_MS = 1500

const NO_CONTENT: CachedEntries = { cottages: null, rewards: null, lookup: null }

/* The language i18next is on right now, as a content language. */
function currentLanguage(): Language {
  return toLanguage(i18n.resolvedLanguage ?? i18n.language)
}

/* The value, or the fallback when the read fails or the deadline passes. */
function raced<T>(promise: Promise<T>, deadline: Promise<void>, fallback: T): Promise<T> {
  return Promise.race([promise.catch(() => fallback), deadline.then(() => fallback)])
}

function idList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
}

export async function bootstrap(): Promise<BootResult> {
  const deadline = new Promise<void>((resolve) => setTimeout(resolve, BOOT_TIMEOUT_MS))
  let storageOk = true
  const unreadable = <T,>(fallback: () => T) => () => {
    storageOk = false
    return fallback()
  }
  /* The cache entries are per language, so they wait for the restored one. */
  const language = restoreLanguage().then(currentLanguage)
  const [resolvedLanguage, progress, queue, welcomeSeen, rewardsSeen, content] = await Promise.all([
    raced(language, deadline, currentLanguage()),
    loadProgress().catch(unreadable(emptyProgress)),
    loadQueue().catch(unreadable(emptyQueue)),
    raced(readJson<boolean>(STORAGE_KEYS.welcomeSeen), deadline, false),
    raced(readJson<unknown>(STORAGE_KEYS.rewardsSeen), deadline, null),
    raced(language.then(readCachedEntries), deadline, NO_CONTENT),
  ])
  return {
    welcomeSeen: welcomeSeen === true,
    progress,
    queue,
    rewardsSeen: idList(rewardsSeen),
    content,
    language: resolvedLanguage,
    storageOk,
  }
}
