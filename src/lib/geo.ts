/* Geography of the expedition map. Deliberately free of Leaflet imports so the
   country detection can be used outside the lazy-loaded map bundle. */

/* [[south, west], [north, east]] — the tuple form L.latLngBounds accepts. */
export type BoundsTuple = [[number, number], [number, number]]

/* Country of the original cottages; entries in data/cottages.json without a
   `country` field are treated as this one. */
export const DEFAULT_COUNTRY = 'PL'

/* The map never zooms or pans beyond this box — mainland Europe plus the
   British Isles and Scandinavia. */
export const EUROPE_BOUNDS: BoundsTuple = [[34.5, -11.5], [71.8, 35]]

/* Approximate framing boxes per ISO 3166-1 alpha-2 code — what the map shows
   as the "whole country" view. These are presentation boxes, not borders:
   mainland only (France without its overseas territories, Spain without the
   Canaries). A country absent here falls back to the bounds of its cottages. */
export const COUNTRY_BOUNDS: Record<string, BoundsTuple> = {
  AT: [[46.37, 9.53], [49.02, 17.16]],
  BE: [[49.5, 2.54], [51.51, 6.41]],
  BG: [[41.23, 22.36], [44.22, 28.61]],
  CH: [[45.82, 5.96], [47.81, 10.49]],
  CZ: [[48.55, 12.09], [51.06, 18.87]],
  DE: [[47.27, 5.87], [55.06, 15.04]],
  DK: [[54.56, 8.07], [57.75, 12.69]],
  EE: [[57.51, 21.76], [59.68, 28.21]],
  ES: [[35.95, -9.39], [43.79, 3.32]],
  FI: [[59.81, 20.55], [70.09, 31.59]],
  FR: [[41.33, -5.15], [51.09, 9.56]],
  GB: [[49.96, -7.57], [58.64, 1.77]],
  GR: [[34.8, 19.37], [41.75, 28.25]],
  HR: [[42.38, 13.49], [46.55, 19.45]],
  HU: [[45.74, 16.11], [48.59, 22.9]],
  IE: [[51.42, -10.48], [55.39, -5.99]],
  IT: [[36.62, 6.63], [47.1, 18.52]],
  LT: [[53.9, 20.95], [56.45, 26.84]],
  LU: [[49.44, 5.73], [50.18, 6.53]],
  LV: [[55.67, 20.97], [58.09, 28.24]],
  NL: [[50.75, 3.35], [53.55, 7.23]],
  NO: [[57.98, 4.65], [71.19, 31.08]],
  PL: [[49.0, 14.1], [54.9, 24.15]],
  PT: [[36.96, -9.53], [42.15, -6.19]],
  RO: [[43.62, 20.26], [48.27, 29.76]],
  SE: [[55.34, 11.11], [69.06, 24.16]],
  SI: [[45.42, 13.38], [46.88, 16.61]],
  SK: [[47.7, 16.83], [49.62, 22.57]],
  UA: [[44.38, 22.14], [52.38, 40.23]],
}

/* The site is served statically (GitHub Pages), so the Accept-Language header
   never reaches any code we control — navigator.languages is the browser-side
   mirror of that header. A locale's region subtag ("pl-PL", "de-AT") names the
   country directly; a bare language code is expanded to its most likely region
   ("pl" → PL) by Intl.Locale.maximize(). Never asks for geolocation. */
export function detectCountry(languages: readonly string[] = navigator.languages): string | null {
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).maximize().region
      if (region && /^[A-Z]{2}$/.test(region)) return region
    } catch {
      // A malformed language tag is simply skipped.
    }
  }
  return null
}
