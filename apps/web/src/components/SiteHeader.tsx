import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackIcon, ForwardIcon, IconButton, iconSize } from '../ui'
import { LanguageMenu } from './LanguageMenu'
import './SiteChrome.css'

export type NavigationItem = {
  label: string
  href?: string
  onClick?: () => void
  primary?: boolean
}

type SiteHeaderProps = {
  items: NavigationItem[]
}

export function SiteHeader({ items }: SiteHeaderProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  /* Desktop shows a back arrow on the primary item only; the mobile menu
     hides it and shows a forward arrow on every item instead (SiteChrome.css). */
  const back = <BackIcon className="nav-back" size={iconSize.sm} weight="bold" aria-hidden />
  const forward = <ForwardIcon className="nav-arrow" size={iconSize.sm} aria-hidden />

  return (
    <header className="site-header">
      <a className="brand" href="index.html" aria-label={t('header.brandAria')}>
        <img src="assets/img/logo.webp" alt="" />
        <span>Chatynkowo</span>
      </a>
      <nav className={`main-nav${open ? ' is-open' : ''}`} aria-label={t('header.navAria')} data-title={t('header.mobileNavTitle')}>
        {items.map((item) => item.href ? (
          <a
            key={item.label}
            className={item.primary ? 'nav-primary' : undefined}
            href={item.href}
            onClick={() => setOpen(false)}
          >{item.primary && back}{item.label}{forward}</a>
        ) : (
          <button key={item.label} type="button" onClick={() => { setOpen(false); item.onClick?.() }}>{item.label}{forward}</button>
        ))}
      </nav>
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
