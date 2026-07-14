import { FacebookLogo, InstagramLogo } from '@phosphor-icons/react'
import './SiteChrome.css'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <a className="footer-brand" href="#top"><img src="assets/img/logo.webp" alt="" /><span>Chatynkowo</span></a>
      <nav aria-label="Dokumenty"><a href="legal/regulamin.html">Regulamin</a><a href="legal/polityka-prywatnosci.html">Polityka prywatności</a></nav>
      <nav aria-label="Media społecznościowe">
        <a href="https://www.instagram.com/chatynkowo.pl/" rel="noreferrer" target="_blank"><InstagramLogo size={20} /> Instagram</a>
        <a href="https://www.facebook.com/chatynkowo/" rel="noreferrer" target="_blank"><FacebookLogo size={20} /> Facebook</a>
      </nav>
    </footer>
  )
}
