import { useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button'
import { cx } from './classes'
import { CloseIcon, iconSize } from './icons'
import { useModalLayer } from './useModalLayer'

/* One dialog for the whole site: backdrop, card, close control, keyboard
   and focus behaviour. Mount it only while open (`{open && <Modal …>}`);
   the page-specific look comes from `className` on the card, e.g.
   "story-modal". Name the dialog with `labelledBy` (id of its heading) or
   `label` (plain text) — one of them is required for assistive tech. */

type ModalProps = {
  onClose: () => void
  /* Accessible name of the close control, e.g. t('story.closeAria'). */
  closeLabel: string
  labelledBy?: string
  label?: string
  className?: string
  /* A card opened on top of another modal. */
  stacked?: boolean
  /* Semantic element of the card. */
  as?: 'section' | 'article' | 'figure' | 'div'
  /* What takes the focus on open; the close control by default, a field
     for a dialog that exists to be typed into. */
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}

export function Modal({ onClose, closeLabel, labelledBy, label, className, stacked, as: Card = 'section', initialFocus, children }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useModalLayer(onClose, initialFocus ?? closeRef)

  return createPortal(
    <div
      className={cx('modal-backdrop', stacked && 'is-stacked')}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <Card className={cx('modal-card', className)} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={label}>
        <IconButton ref={closeRef} className="modal-close" label={closeLabel} onClick={onClose}>
          <CloseIcon size={iconSize.lg} />
        </IconButton>
        {children}
      </Card>
    </div>,
    document.body,
  )
}
