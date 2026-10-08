import type { ComponentPropsWithRef } from 'react'
import { cx } from './classes'

/* The site's buttons. Four visual variants, one markup contract:
   - primary: the single main action of a view,
   - ghost:   secondary actions on the raised surface (default),
   - subtle:  tertiary actions, e.g. sign out,
   - danger:  a destructive action, e.g. delete the account.
   Use Button for actions, LinkButton for navigation that looks like a button,
   IconButton for icon-only controls (the accessible name is mandatory).
   A disabled button is one that cannot act; one whose action is in flight
   says so with aria-busy and shows the wait cursor. */

export type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger'

type ButtonProps = ComponentPropsWithRef<'button'> & { variant?: ButtonVariant }

export function Button({ variant = 'ghost', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx('button', `button-${variant}`, className)} {...rest} />
}

type LinkButtonProps = ComponentPropsWithRef<'a'> & { variant?: ButtonVariant }

export function LinkButton({ variant = 'ghost', className, ...rest }: LinkButtonProps) {
  return <a className={cx('button', `button-${variant}`, className)} {...rest} />
}

type IconButtonProps = Omit<ComponentPropsWithRef<'button'>, 'aria-label'> & {
  /* What the control does — read by assistive tech, shown as the tooltip. */
  label: string
}

export function IconButton({ label, className, type = 'button', ...rest }: IconButtonProps) {
  return <button type={type} className={cx('icon-button', className)} aria-label={label} title={label} {...rest} />
}
