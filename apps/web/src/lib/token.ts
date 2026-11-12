/* The claims of a session's access token, read without checking the
   signature: the token is the browser's own, and its claims are read to
   describe the session (its id, how and when it authenticated), never to
   trust it. Throws on a token that is not a JWT. */
export function tokenClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? ''
  const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0))
  const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (typeof claims !== 'object' || claims === null) throw new Error('The token carries no claims.')
  return claims as Record<string, unknown>
}
