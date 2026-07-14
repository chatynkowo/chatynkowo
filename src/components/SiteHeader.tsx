import { useState } from 'react'
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
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <a className="brand" href="index.html" aria-label="Chatynkowo, strona główna">
        <img src="assets/img/logo.webp" alt="" />
        <span>Chatynkowo</span>
      </a>
      <nav className={`main-nav${open ? ' is-open' : ''}`} aria-label="Główna nawigacja">
        {items.map((item) => item.href ? (
          <a
            key={item.label}
            className={item.primary ? 'nav-primary' : undefined}
            href={item.href}
            onClick={() => setOpen(false)}
          >{item.primary && <span aria-hidden="true">←</span>}{item.label}</a>
        ) : (
          <button key={item.label} type="button" onClick={() => { setOpen(false); item.onClick?.() }}>{item.label}</button>
        ))}
      </nav>
      <button type="button" className="nav-toggle icon-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}>
        <span className={`burger-icon${open ? ' is-open' : ''}`} aria-hidden="true"><i /><i /><i /></span>
      </button>
    </header>
  )
}
