import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { STORE_LINKS, type StoreId } from '@chatynkowo/core'
import { track } from '../lib/analytics'
import { AppStoreIcon, GooglePlayIcon, LinkButton, type ButtonVariant, type Icon } from '../ui'

export type Store = {
  id: StoreId
  Icon: Icon
  /* A brand, so the same in every language. */
  name: string
  /* The path the store's clicks are counted under. */
  path: string
}

/* The stores the app is in, in the order the site names them. A store's
   words live in the dictionaries under `app.<id>`. */
export const STORES: readonly Store[] = [
  { id: 'googlePlay', Icon: GooglePlayIcon, name: 'Google Play', path: 'app-google-play' },
  { id: 'appStore', Icon: AppStoreIcon, name: 'App Store', path: 'app-app-store' },
]

/* The store the visitor's own device installs from, read off the browser's
   user agent: Google Play on Android, the App Store on an iPhone or iPad.
   A computer installs from neither, so it gets none and the site offers
   both. An iPad's Safari presents itself as a Mac; touch points tell the
   two apart. */
export function visitorStore(): Store | null {
  const agent = navigator.userAgent
  const apple = /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
  const id: StoreId | null = /Android/i.test(agent) ? 'googlePlay' : apple ? 'appStore' : null
  return STORES.find((store) => store.id === id) ?? null
}

type StoreLinkProps = {
  store: Store
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}

/* A button to the app's listing in one store. It opens in a new tab, and
   the click is counted like a page view, under the store's own path, so the
   store's install figures can be compared with how many seekers set off
   from here. */
export function StoreLink({ store, variant = 'primary', className, children }: StoreLinkProps) {
  const { t } = useTranslation()

  return (
    <LinkButton
      variant={variant}
      className={className}
      href={STORE_LINKS[store.id]}
      rel="noreferrer"
      target="_blank"
      aria-label={t(`app.${store.id}.downloadAria`)}
      onClick={() => track(store.path, `Aplikacja: ${store.name}`)}
    >
      {children}
    </LinkButton>
  )
}
