/* Rules of the leaderboard, shared by the ranking page and the app's
   Ranking tab. */

/* The longest nickname the leaderboard shows. */
export const DISPLAY_NAME_MAX_LENGTH = 40

/* The expedition duration as "2 d 3 h", "3 h 12 min", "12 min" or "40 s",
   or null when there is none — the caller renders the localized "no time"
   fallback. The unit letters read the same in Polish and English. */
export function formatElapsed(value: number | string | null | undefined): string | null {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 1) return null
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days) return `${days} d ${hours} h`
  if (hours) return `${hours} h ${minutes} min`
  return minutes ? `${minutes} min` : `${Math.floor(seconds)} s`
}

/* What a profile editor may change. */
export type ProfileFields = { display_name: string; avatar_url: string | null }

/* The patch a profile editor sends, or null when nothing would change: an
   empty nickname keeps the current one or falls back to the caller's
   default; the avatar is the provider's picture or nothing. */
export function profilePatch(
  current: ProfileFields,
  input: { name: string; showAvatar: boolean; avatarUrl: string | null; fallbackName: string },
): ProfileFields | null {
  const display_name = input.name.trim() || current.display_name || input.fallbackName
  const avatar_url = input.showAvatar ? input.avatarUrl : null
  return display_name === current.display_name && avatar_url === current.avatar_url ? null : { display_name, avatar_url }
}

/* Up to two initials for an avatar placeholder. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
