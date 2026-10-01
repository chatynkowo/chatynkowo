import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForwardIcon, IconButton, iconSize } from '../ui'
import { HeaderAccount } from './HeaderAccount'
import { LanguageMenu } from './LanguageMenu'
import type { SitePageId } from './SitePage'
import './SiteChrome.css'

export type NavigationItem = {
  label: string
  href?: string
  onClick?: () => void
}

type SiteHeaderProps = {
  /* The page this header is on: the account control marks it as current. */
  page: SitePageId
  items: NavigationItem[]
}

export function SiteHeader({ page, items }: SiteHeaderProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  /* The folded menu shows a forward arrow on every item (SiteChrome.css). */
  const forward = <ForwardIcon className="nav-arrow" size={iconSize.sm} aria-hidden />

  return (
    <header className="site-header">
      <a className="brand" href="index.html" aria-label={t('header.brandAria')}>
        <img src="assets/img/logo.webp" alt="" />
        <span>Chatynkowo</span>
      </a>
      <nav className={`main-nav${open ? ' is-open' : ''}`} aria-label={t('header.navAria')} data-title={t('header.mobileNavTitle')}>
        {items.map((item) => item.href ? (
          <a key={item.label} href={item.href} onClick={() => setOpen(false)}>{item.label}{forward}</a>
        ) : (
          <button key={item.label} type="button" onClick={() => { setOpen(false); item.onClick?.() }}>{item.label}{forward}</button>
        ))}
      </nav>
      <HeaderAccount page={page} />
      <LanguageMenu />
      <IconButton
        className="nav-toggle"
        label={open ? t('header.closeMenu') : t('header.openMenu')}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={`burger-icon${open ? ' is-open' : ''}`} aria-hidden="true"><i /><i /><i /></span>
      </IconButton>
    </header>
  )
}
