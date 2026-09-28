/* Hands a scanned plaque code from the scanner route to the Code tab
   without going through route params: the scanner posts, dismisses itself,
   and the Code screen takes the code when it regains focus. */

let pending: string | null = null
const listeners = new Set<(code: string) => void>()

export function postScannedCode(code: string) {
  pending = code
  listeners.forEach((listener) => listener(code))
}

/* Returns and clears the code left by the scanner, if any. */
export function takeScannedCode(): string | null {
  const code = pending
  pending = null
  return code
}

export function onScannedCode(listener: (code: string) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
