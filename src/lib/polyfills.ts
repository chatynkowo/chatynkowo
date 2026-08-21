/* structuredClone fallback for browsers older than Chrome 98 / Safari 15.4.
   Covers what an app-state clone can contain (JSON-like data plus Date, Map,
   Set, RegExp and cyclic references) — not transferables, typed arrays, or
   platform objects. Import this before any module that may call it. */
if (typeof globalThis.structuredClone !== 'function') {
  const deepClone = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
    if (value === null || typeof value !== 'object') return value
    if (seen.has(value)) return seen.get(value)
    if (value instanceof Date) return new Date(value.getTime())
    if (value instanceof RegExp) return new RegExp(value.source, value.flags)
    if (value instanceof Map) {
      const copy = new Map<unknown, unknown>()
      seen.set(value, copy)
      value.forEach((v, k) => copy.set(deepClone(k, seen), deepClone(v, seen)))
      return copy
    }
    if (value instanceof Set) {
      const copy = new Set<unknown>()
      seen.set(value, copy)
      value.forEach((v) => copy.add(deepClone(v, seen)))
      return copy
    }
    if (Array.isArray(value)) {
      const copy: unknown[] = []
      seen.set(value, copy)
      value.forEach((v, i) => {
        copy[i] = deepClone(v, seen)
      })
      return copy
    }
    const copy: Record<string, unknown> = {}
    seen.set(value, copy)
    for (const key of Object.keys(value)) {
      copy[key] = deepClone((value as Record<string, unknown>)[key], seen)
    }
    return copy
  }
  globalThis.structuredClone = (<T,>(value: T): T =>
    deepClone(value, new WeakMap()) as T) as typeof structuredClone
}

export {}
