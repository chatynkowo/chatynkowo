import { useEffect, useRef, type RefObject } from 'react'

/* Everything a modal layer needs from the document, in one place:
   - the page behind it stops scrolling and becomes inert (also hidden from
     assistive tech) while at least one layer is open,
   - Escape closes the topmost layer only, so a card stacked on another card
     peels off one level at a time,
   - focus moves into the layer on open and returns to the opener on close.
   Layers are tracked in a module-level stack, so components never have to
   coordinate with each other. */

const openLayers: symbol[] = []

/* The application root; modals themselves render in a portal outside it. */
const APP_ROOT_ID = 'root'

function lockPage() {
  document.body.classList.add('modal-open')
  const root = document.getElementById(APP_ROOT_ID)
  if (root) {
    root.inert = true
    root.setAttribute('aria-hidden', 'true')
  }
}

function unlockPage() {
  document.body.classList.remove('modal-open')
  const root = document.getElementById(APP_ROOT_ID)
  if (root) {
    root.inert = false
    root.removeAttribute('aria-hidden')
  }
}

export function useModalLayer(onClose: () => void, initialFocus?: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const layer = Symbol('modal-layer')
    const previousFocus = document.activeElement as HTMLElement | null
    openLayers.push(layer)
    if (openLayers.length === 1) lockPage()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || openLayers[openLayers.length - 1] !== layer) return
      event.preventDefault()
      onCloseRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    const focusFrame = window.requestAnimationFrame(() => initialFocus?.current?.focus())

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', closeOnEscape)
      openLayers.splice(openLayers.indexOf(layer), 1)
      if (!openLayers.length) unlockPage()
      previousFocus?.focus()
    }
    // The layer lives exactly as long as the component that mounted it, so the
    // effect deliberately runs once; onClose is read through the ref.
  }, [])
}
