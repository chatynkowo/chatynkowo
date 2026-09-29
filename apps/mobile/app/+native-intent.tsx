import * as WebBrowser from 'expo-web-browser'
import { codeFromScan } from '@chatynkowo/core'
import { STORAGE_KEYS } from '../src/config'
import { readJson } from '../src/lib/storage'

/* Where a URL handed to the app goes. A plaque link (the site's address or
   the chatynkowo scheme with a `kod` or `code` parameter) opens the code
   sheet with the code, or the onboarding first on a fresh install. Story and
   reward links map onto their routes. Any other page of the site claimed by
   an app link opens in the in-app browser and the app itself stays on the
   Atlas. */

const CODE_PARAM = /[?&#](?:kod|code)=\d{4}(?!\d)/i
const SCHEME_ROUTE = /^chatynkowo:\/\/(story|reward)\//
const SITE_URL = /^https?:\/\/(www\.)?chatynkowo\.pl/i

export async function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): Promise<string> {
  try {
    if (__DEV__) console.info('native-intent', { path, initial })
    const code = CODE_PARAM.test(path) ? codeFromScan(path) : null
    /* The same flag the bootstrap reads for the Protected guard: until the
       welcome was seen the tabs do not exist, so every link lands there. */
    const seen = code || SCHEME_ROUTE.test(path) ? await readJson<boolean>(STORAGE_KEYS.welcomeSeen) : true
    if (code) return seen ? `/code?code=${code}` : `/welcome?code=${code}`
    if (SCHEME_ROUTE.test(path)) return seen ? path.replace(/^chatynkowo:\/\//, '/') : '/welcome'
    if (SITE_URL.test(path)) {
      void WebBrowser.openBrowserAsync(path)
      return '/'
    }
    return path
  } catch {
    return '/'
  }
}
