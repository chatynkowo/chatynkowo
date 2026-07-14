type AnalyticsEvent = { id: string; path: string; title?: string }

const STORAGE_KEY = 'chatynkowo:gc-queue:v1'
const ENDPOINT = 'https://chatynkowo.goatcounter.com/count'
let flushing = false

function readQueue(): AnalyticsEvent[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value as AnalyticsEvent[] : []
  } catch {
    return []
  }
}

function writeQueue(queue: AnalyticsEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-200))) } catch { /* best effort */ }
}

async function flush() {
  if (flushing || navigator.onLine === false) return
  flushing = true
  try {
    for (const event of readQueue()) {
      const params = new URLSearchParams({ p: event.path, e: 'true', rnd: crypto.randomUUID() })
      if (event.title) params.set('t', event.title)
      try {
        await fetch(`${ENDPOINT}?${params}`, { mode: 'no-cors', cache: 'no-store', keepalive: true })
        writeQueue(readQueue().filter((item) => item.id !== event.id))
      } catch {
        break
      }
    }
  } finally {
    flushing = false
  }
}

export function track(path: string, title?: string) {
  const queue = readQueue()
  queue.push({ id: crypto.randomUUID(), path, title })
  writeQueue(queue)
  void flush()
}

export function initializeAnalytics() {
  window.addEventListener('online', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void flush() })
  void flush()
  return () => window.removeEventListener('online', flush)
}
