import { ATTEMPT_TIMEOUT_MS, retryDelay, withTimeout } from '@chatynkowo/core'

/* Keeps at something the backend has to take until it has: the site's
   answer to a connection that comes and goes while the page stays open.
   A try that fails (or does not answer in time) is tried again after a
   growing pause (core's retryDelay); the browser coming back online, or
   the page coming back to the front, tries at once and starts the pauses
   over. A task asks `offline` first and sends nothing while the browser
   says there is no connection: the `online` event is then the next real
   try. The app does the same with its reconnect and foreground hooks
   (ProgressProvider). */

/* What the browser says of the connection; not knowing counts as online. */
export function offline(): boolean {
  return navigator.onLine === false
}

export type Persistent = {
  /* Try now; while a try is in flight, once more after it. */
  kick: () => void
  /* Leave it: no more tries, no listeners left behind. */
  stop: () => void
}

/* `attempt` resolves to true when nothing is left to do and to false when
   it should be tried again; a rejection counts as false. It runs once per
   kick, so it must be cheap when there is nothing to send. */
export function persist(attempt: () => Promise<boolean>): Persistent {
  let stopped = false
  let running = false
  let again = false
  let failures = 0
  let timer: number | undefined

  async function run() {
    window.clearTimeout(timer)
    if (stopped) return
    if (running) {
      again = true
      return
    }
    running = true
    let done = false
    try {
      done = await withTimeout(attempt(), ATTEMPT_TIMEOUT_MS)
    } catch {
      // No answer in time, or a task that threw: one more failure.
    }
    running = false
    if (stopped) return
    if (again) {
      again = false
      void run()
      return
    }
    failures = done ? 0 : failures + 1
    if (!done) timer = window.setTimeout(() => void run(), retryDelay(failures))
  }

  /* The world changed: whatever the pause was, this is a fresh start. */
  function wake() {
    failures = 0
    void run()
  }
  function shown() {
    if (document.visibilityState === 'visible') wake()
  }
  window.addEventListener('online', wake)
  document.addEventListener('visibilitychange', shown)

  return {
    kick: () => void run(),
    stop() {
      stopped = true
      window.clearTimeout(timer)
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', shown)
    },
  }
}
