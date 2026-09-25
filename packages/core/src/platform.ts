/* Platform adapters. The package assumes neither the DOM nor Node — whatever
   depends on the environment (fetching files, SHA-256) is injected: the
   browser uses its built-in fetch and WebCrypto, React Native supplies its
   own hash (e.g. expo-crypto), and tests can pass stubs. */

export interface ResponseLike {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

export type FetchInit = { cache?: 'default' | 'no-store' | 'no-cache' | 'reload' | 'force-cache' }

export type FetchLike = (url: string, init?: FetchInit) => Promise<ResponseLike>

/* Hex SHA-256 of a UTF-8 string. */
export type Sha256Hex = (text: string) => Promise<string>

/* Global fetch (browser, React Native, Node 18+), called on globalThis so
   browsers don't throw "Illegal invocation" on a detached reference. */
export function defaultFetch(): FetchLike {
  const g = globalThis as { fetch?: FetchLike }
  if (typeof g.fetch !== 'function') {
    throw new Error('No global fetch — pass your own implementation to createContentClient({ fetch }).')
  }
  return (url, init) => g.fetch!(url, init)
}

type SubtleLike = { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> }
type TextEncoderLike = new () => { encode(text: string): Uint8Array }

/* WebCrypto implementation — available in every browser and in Node 20+.
   React Native (Hermes) has no crypto.subtle: pass e.g. expo-crypto's
   digestStringAsync instead. */
export const webCryptoSha256Hex: Sha256Hex = async (text) => {
  const g = globalThis as { crypto?: { subtle?: SubtleLike }; TextEncoder?: TextEncoderLike }
  if (!g.crypto?.subtle || !g.TextEncoder) {
    throw new Error('WebCrypto is unavailable in this environment — pass sha256Hex to createContentClient (e.g. expo-crypto).')
  }
  const digest = await g.crypto.subtle.digest('SHA-256', new g.TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
