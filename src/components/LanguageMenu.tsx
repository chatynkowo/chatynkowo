import { useEffect, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, toLanguage } from '../i18n'
import './SiteChrome.css'

/* The site's own dropdown for picking the interface language. A native
   <select> pops the OS-styled list, which breaks the storybook look — so the
   list is rendered by the site itself, in the same style as the header. */
export function LanguageMenu() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const activeCode = toLanguage(i18n.resolvedLanguage)
  const active = LANGUAGES.find((language) => language.code === activeCode) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    /* Tab-out closes via focusin on the document — never via blur with
       relatedTarget: Safari does not focus buttons on click, so there a
       blur-based close fires mid-click with relatedTarget=null and unmounts
       the option before its click event, swallowing the selection. */
    const closeOnFocusOutside = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('focusin', closeOnFocusOutside)
    document.addEventListener('keydown', closeOnEscape)
    // Focus lands on the current language, so arrows/Enter work right away.
    listRef.current?.querySelector<HTMLButtonElement>('[aria-current]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('focusin', closeOnFocusOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function moveFocus(offset: number) {
    const options = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const index = options.indexOf(document.activeElement as HTMLButtonElement)
    options[(index + offset + options.length) % options.length]?.focus()
  }

  function choose(code: string) {
    void i18n.changeLanguage(code)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="language-menu">
      <button
        ref={triggerRef}
        type="button"
        className="language-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('header.languageAria')}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span lang={active.code}>{active.nativeName}</span>
        <CaretDown size={13} weight="bold" aria-hidden />
      </button>
      {open && (
        <ul
          ref={listRef}
          className="language-menu-list"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(1) }
            if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-1) }
          }}
        >
          {LANGUAGES.map(({ code, nativeName }) => (
            <li key={code}>
              <button
                type="button"
                lang={code}
                aria-current={code === active.code ? 'true' : undefined}
                onClick={() => choose(code)}
              >
                {nativeName}
                {code === active.code && <Check size={15} weight="bold" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
