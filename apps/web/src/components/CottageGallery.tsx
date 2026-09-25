import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, Modal, NextIcon, PreviousIcon, iconSize } from '../ui'

/* Gallery of cottage photos: a compact strip of thumbnails right under the
   intro copy; a tapped thumbnail opens the full-size photo with prev/next
   browsing. */
export function CottageGallery({ images }: { images: Array<{ full: string; thumb: string }> }) {
  const { t } = useTranslation()
  const [viewed, setViewed] = useState<number | null>(null)
  const open = viewed !== null

  const step = (offset: number) =>
    setViewed((current) => current === null ? current : (current + offset + images.length) % images.length)

  /* Escape, focus and the page lock come from the Modal; the lightbox adds
     only its own arrow-key browsing. */
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, images.length])

  return (
    <>
      <ul className="lore-gallery" aria-label={t('gallery.listAria')}>
        {images.map((image, index) => (
          <li key={image.full}>
            <button
              type="button"
              onClick={() => setViewed(index)}
              aria-label={t('gallery.openPhoto', { index: index + 1, count: images.length })}
            >
              <img src={image.thumb} alt="" loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <Modal
          as="figure"
          className="gallery-lightbox"
          label={t('gallery.lightboxAria', { index: viewed + 1, count: images.length })}
          closeLabel={t('gallery.closeAria')}
          onClose={() => setViewed(null)}
        >
          <img src={images[viewed].full} alt={t('gallery.photoAlt')} decoding="async" />
          <figcaption>
            <IconButton label={t('gallery.previous')} onClick={() => step(-1)}>
              <PreviousIcon size={iconSize.md} />
            </IconButton>
            <span>{viewed + 1} / {images.length}</span>
            <IconButton label={t('gallery.next')} onClick={() => step(1)}>
              <NextIcon size={iconSize.md} />
            </IconButton>
          </figcaption>
        </Modal>
      )}
    </>
  )
}
