import { useEffect, useRef, useState } from 'react'
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react'

/* Gallery of cottage photos: a compact strip of thumbnails right under the
   intro copy; a tapped thumbnail opens the full-size photo with prev/next
   browsing. */
export function CottageGallery({ images }: { images: Array<{ full: string; thumb: string }> }) {
  const [viewed, setViewed] = useState<number | null>(null)
  const open = viewed !== null
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.classList.add('modal-open')
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewed(null)
      if (event.key === 'ArrowLeft') {
        setViewed((current) => current === null ? current : (current + images.length - 1) % images.length)
      }
      if (event.key === 'ArrowRight') {
        setViewed((current) => current === null ? current : (current + 1) % images.length)
      }
    }
    document.addEventListener('keydown', handleKey)
    closeButtonRef.current?.focus()
    return () => {
      document.body.classList.remove('modal-open')
      document.removeEventListener('keydown', handleKey)
      previousFocus?.focus()
    }
  }, [open, images.length])

  return (
    <>
      <ul className="lore-gallery" aria-label="Galeria zdjęć Chatynek">
        {images.map((image, index) => (
          <li key={image.full}>
            <button
              type="button"
              onClick={() => setViewed(index)}
              aria-label={`Powiększ zdjęcie ${index + 1} z ${images.length}`}
            >
              <img src={image.thumb} alt="" loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setViewed(null)}>
          <figure className="modal-card gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Zdjęcie ${viewed + 1} z ${images.length}`}>
            <button ref={closeButtonRef} className="icon-button modal-close" type="button" onClick={() => setViewed(null)} aria-label="Zamknij podgląd">
              <X size={22} />
            </button>
            <img src={images[viewed].full} alt="Baśniowa chatynka Elfów ukryta w lesie" decoding="async" />
            <figcaption>
              <button className="icon-button" type="button" onClick={() => setViewed((viewed + images.length - 1) % images.length)} aria-label="Poprzednie zdjęcie">
                <CaretLeft size={20} />
              </button>
              <span>{viewed + 1} / {images.length}</span>
              <button className="icon-button" type="button" onClick={() => setViewed((viewed + 1) % images.length)} aria-label="Następne zdjęcie">
                <CaretRight size={20} />
              </button>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
