import { FacebookIcon, InstagramIcon, iconSize } from '../ui'
import { useTranslation } from 'react-i18next'
import './SiteChrome.css'

export function SiteFooter() {
  const { t } = useTranslation()

  return (
    <footer className="site-footer">
      <a className="footer-brand" href="#top"><img src="assets/img/logo.webp" alt="" /><span>Chatynkowo</span></a>
      {/* The legal pages exist as separate documents per language, so their
          hrefs live in the dictionaries next to the labels. */}
      <nav aria-label={t('footer.docsAria')}><a href={t('footer.termsHref')}>{t('footer.terms')}</a><a href={t('footer.privacyHref')}>{t('footer.privacy')}</a></nav>
      <nav aria-label={t('footer.socialAria')}>
        <a href="https://www.instagram.com/chatynkowo.pl/" rel="noreferrer" target="_blank"><InstagramIcon size={iconSize.md} /> Instagram</a>
        <a href="https://www.facebook.com/chatynkowo/" rel="noreferrer" target="_blank"><FacebookIcon size={iconSize.md} /> Facebook</a>
      </nav>
      <span className="footer-rev" aria-hidden="true">rev: {__COMMIT_HASH__}</span>
    </footer>
  )
}
