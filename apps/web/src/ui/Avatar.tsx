import { initials } from '@chatynkowo/core'
import { cx } from './classes'

/* A seeker's picture, or their initials on the placeholder disc when the
   account shares none. Decorative: the name is always written next to it. */

type AvatarProps = {
  name: string
  src: string | null
  className?: string
}

export function Avatar({ name, src, className }: AvatarProps) {
  return src ? (
    <img className={cx('avatar', className)} src={src} alt="" loading="lazy" />
  ) : (
    <span className={cx('avatar', className)} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
