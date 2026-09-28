import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { isValidCode } from '@chatynkowo/core'
import { resolveCodeOffline } from '../../lib/content'
import { useContent, useProgress } from '../../providers'
import { onScannedCode, takeScannedCode } from './scanResult'

/* The code gate, shared by manual entry and the QR scanner: validate the
   four digits offline against the cached lookup, apply the discovery, then
   open the story. Message keys are the site's (`code.*`), so both surfaces
   speak the same words. */

type CodePhase = 'idle' | 'checking' | 'error' | 'success'

export function useCodeEntry() {
  const router = useRouter()
  const { cottageBySlug, offline, status } = useContent()
  const { discover } = useProgress()
  const [value, setValue] = useState('')
  const [phase, setPhase] = useState<CodePhase>('idle')
  const [messageKey, setMessageKey] = useState<string | null>(null)

  const change = useCallback((next: string) => {
    setValue(next.replace(/\D/g, '').slice(0, 4))
    setPhase((current) => (current === 'idle' ? current : 'idle'))
    setMessageKey(null)
  }, [])

  const submit = useCallback(
    async (code: string = value) => {
      if (!isValidCode(code)) {
        setPhase('error')
        setMessageKey('code.invalid')
        return
      }
      setPhase('checking')
      setMessageKey('code.checking')
      try {
        const slug = await resolveCodeOffline(code, offline)
        const cottage = slug ? cottageBySlug(slug) : undefined
        if (!cottage) {
          setPhase('error')
          setMessageKey('code.unknown')
          return
        }
        const result = await discover(cottage.slug, code)
        setPhase('success')
        setMessageKey(result.isNew ? 'code.unlocked' : 'code.alreadyFound')
        setValue('')
        router.push({ pathname: '/story/[slug]', params: { slug: cottage.slug, revisit: result.isNew ? '0' : '1' } })
      } catch {
        setPhase('error')
        setMessageKey('code.failed')
      }
    },
    [value, offline, cottageBySlug, discover, router],
  )

  /* A code posted by the scanner is submitted as soon as the content is
     there to match it against. */
  useEffect(() => {
    if (status !== 'ready') return
    const pending = takeScannedCode()
    if (pending) {
      setValue(pending)
      void submit(pending)
    }
    return onScannedCode((code) => {
      setValue(code)
      void submit(code)
    })
  }, [status, submit])

  return { value, change, submit, phase, messageKey, checking: phase === 'checking' }
}
