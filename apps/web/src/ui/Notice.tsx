import type { ReactNode } from 'react'
import { cx } from './classes'

/* One inline message for the whole site: a note that explains a state, a
   receipt after an action worked, a complaint when it did not. The tone
   picks the look and the live-region role, so assistive tech hears a
   receipt or a complaint as it appears.

   A message that comes and goes (a receipt) needs a region that is already
   on the page when its text changes: mount it once with `live`, without a
   tone while there is nothing to say, and it announces each change. */

export type NoticeTone = 'note' | 'success' | 'error'

type NoticeProps = {
  tone?: NoticeTone
  live?: boolean
  className?: string
  children?: ReactNode
}

const ROLE: Record<NoticeTone, 'alert' | 'status' | undefined> = { note: undefined, success: 'status', error: 'alert' }

export function Notice({ tone, live = false, className, children }: NoticeProps) {
  return (
    <p className={cx('notice', tone && `notice-${tone}`, className)} role={live ? 'status' : tone && ROLE[tone]} aria-live={live ? 'polite' : undefined}>
      {children}
    </p>
  )
}
