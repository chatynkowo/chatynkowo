import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SiteFooter } from './SiteFooter'
import { BackIcon, LinkButton, iconSize } from '../ui'
import { SiteHeader, type NavigationItem } from './SiteHeader'

/* The frame of every page: the shell, the skip link, the header with the
   navigation for this page and the account control, the page's own `main`
   (opened, away from the game, by the way back to it), the footer, and the
   document title and description that follow the language. A page renders
   its content inside and nothing else. */

export type SitePageId = 'home' | 'ranking' | 'profile' | 'deleteAccount'

/* The home page's sections, in its order; other pages link into them. */
const SECTIONS = [
  { id: 'mapa', key: 'nav.map' },
  { id: 'kod', key: 'nav.enterCode' },
  { id: 'o-chatynkowie', key: 'nav.about' },
  { id: 'magia', key: 'nav.notebook' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

const PAGES: Record<SitePageId, { href: string; main: string; title: string; description: string }> = {
  home: { href: 'index.html', main: 'main', title: 'meta.homeTitle', description: 'meta.homeDescription' },
  ranking: { href: 'ranking.html', main: 'ranking-main', title: 'meta.rankingTitle', description: 'meta.rankingDescription' },
  profile: { href: 'profile.html', main: 'profile-main', title: 'meta.profileTitle', description: 'meta.profileDescription' },
  deleteAccount: { href: 'delete-account.html', main: 'delete-account-main', title: 'meta.deleteAccountTitle', description: 'meta.deleteAccountDescription' },
}

type SitePageProps = {
  page: SitePageId
  /* The home page scrolls to its own sections (or opens the code dialog);
     every other page links into index.html. */
  onSection?: (id: SectionId) => void
  mainClassName?: string
  children: ReactNode
}

export function SitePage({ page, onSection, mainClassName, children }: SitePageProps) {
  const { t } = useTranslation()
  const { main, title, description } = PAGES[page]

  useEffect(() => {
    document.title = t(title)
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(description))
  }, [t, title, description])

  const items: NavigationItem[] = SECTIONS.map(({ id, key }) =>
    page === 'home' && onSection ? { label: t(key), onClick: () => onSection(id) } : { label: t(key), href: `${PAGES.home.href}#${id}` },
  )
  if (page !== 'ranking') items.push({ label: t('nav.ranking'), href: PAGES.ranking.href })

  return (
    <div className="site-shell">
      <a className="skip-link" href={`#${main}`}>{t('common.skipToContent')}</a>
      <SiteHeader page={page} items={items} />
      <main id={main} className={mainClassName}>
        {page !== 'home' && (
          <LinkButton className="page-back" href={PAGES.home.href}>
            <BackIcon size={iconSize.sm} weight="bold" aria-hidden /> {t('nav.backToGame')}
          </LinkButton>
        )}
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

/* The address of a page, for links between them. */
export function pageHref(page: SitePageId) {
  return PAGES[page].href
}
