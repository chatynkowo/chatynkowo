/* Display helpers both clients need and neither should write twice. */

/* A country's name in the seeker's language, from the ISO code the content
   carries; the code itself where the host cannot name it. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/* A day from an ISO timestamp, in the seeker's language. */
export function formatDay(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale)
}
