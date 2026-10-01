import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { isValidCode } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { resolveCode, resolveCodeOffline } from '../../lib/content'
import { haptic } from '../../lib/haptics'
import { useContent, useOnline, useProgress } from '../../providers'

/* The code gate, shared by the code sheet and the QR scanner: four digits
   are validated on the device against the cached lookup, the discovery is
   applied once, and the story replaces the current screen. The sheet
   auto-submits at the fourth digit; the scanner submits what it read. A
   code typed before the lookup is on the device is held and checked the
   moment the lookup lands. Message keys are the site's (`code.*`, `quest.*`)
   plus the app's accepted and mismatch lines, so every surface speaks the
   same words. */

export type CodePhase = 'idle' | 'checking' | 'waiting' | 'error' | 'success'

export type ResolveOutcome =
  | { kind: 'new' }
  | { kind: 'found' }
  | { kind: 'invalid' }
  | { kind: 'unknown' }
  | { kind: 'waiting' }
  | { kind: 'failed' }

export type CodeEntryOptions = {
  /* The cottage the sheet was opened for; another cottage's code is still
     accepted, with the mismatch line and a longer beat. */
  expectedSlug?: string
  /* A code carried in by a plaque link; submitted once per value. */
  codeParam?: string
  onOutcome?: (outcome: ResolveOutcome) => void
  /* How long the accepted line stays before the story replaces the screen. */
  successDelayMs?: number
}

type Message = { key: string; params?: Record<string, string> }

const CODE_LENGTH = 4
const SUCCESS_DELAY_MS = 400
const MISMATCH_DELAY_MS = 800
/* The boxes clear once the shake has finished. */
const CLEAR_AFTER_ERROR_MS = 320

const ERROR_KEYS = { invalid: 'code.invalid', unknown: 'code.unknown', failed: 'code.failed' } as const

type ErrorKind = keyof typeof ERROR_KEYS

export function useCodeEntry({ expectedSlug, codeParam, onOutcome, successDelayMs = SUCCESS_DELAY_MS }: CodeEntryOptions = {}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { cottageBySlug, lookup, lookupStatus } = useContent()
  const { discover } = useProgress()
  const online = useOnline()

  const [value, setValue] = useState('')
  const [phase, setPhase] = useState<CodePhase>('idle')
  const [message, setMessage] = useState<Message | null>(null)

  /* Read by the stable submit: the phase and value as of now, and the
     latest props and provider values. Written before the effects below. */
  const phaseRef = useRef<CodePhase>('idle')
  const valueRef = useRef('')
  const latest = useRef({ cottageBySlug, lookup, lookupStatus, discover, online, expectedSlug, onOutcome, successDelayMs, t })
  useEffect(() => {
    latest.current = { cottageBySlug, lookup, lookupStatus, discover, online, expectedSlug, onOutcome, successDelayMs, t }
  })

  /* A check that outlives the sheet (swiped away mid-await) must not open
     the story over whatever came next. */
  const mounted = useRef(true)

  /* A valid code typed before the lookup is on the device. */
  const heldCode = useRef<string | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopClearing = () => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = null
  }
  useEffect(
    () => () => {
      mounted.current = false
      stopClearing()
      if (openTimer.current) clearTimeout(openTimer.current)
    },
    [],
  )

  const moveTo = useCallback((next: CodePhase, text: Message | null) => {
    phaseRef.current = next
    setPhase(next)
    setMessage(text)
  }, [])

  const setCode = useCallback((next: string) => {
    valueRef.current = next
    setValue(next)
  }, [])

  const fail = useCallback(
    (kind: ErrorKind) => {
      const key = ERROR_KEYS[kind]
      moveTo('error', { key })
      haptic('error')
      announce(latest.current.t(key))
      latest.current.onOutcome?.({ kind })
      stopClearing()
      clearTimer.current = setTimeout(() => {
        clearTimer.current = null
        setCode('')
      }, CLEAR_AFTER_ERROR_MS)
    },
    [moveTo, setCode],
  )

  const submit = useCallback(
    async (code: string = valueRef.current) => {
      if (phaseRef.current === 'checking' || phaseRef.current === 'success') return
      const current = latest.current
      if (!isValidCode(code)) {
        fail('invalid')
        return
      }
      if (current.lookupStatus !== 'ready') {
        heldCode.current = code
        moveTo('waiting', { key: current.lookupStatus === 'error' ? 'mobile:code.lookupFailed' : 'mobile:code.waitingForLookup' })
        current.onOutcome?.({ kind: 'waiting' })
        return
      }
      heldCode.current = null
      moveTo('checking', { key: 'quest.checking' })
      try {
        /* The lookup the provider holds needs no storage read; the cached copy
           is the fallback for a provider that has none yet. */
        const slug = current.lookup ? await resolveCode(current.lookup, code) : await resolveCodeOffline(code, current.online === false)
        if (!mounted.current) return
        const cottage = slug ? current.cottageBySlug(slug) : undefined
        if (!cottage) {
          fail('unknown')
          return
        }
        const result = await current.discover(cottage.slug, code)
        if (!mounted.current) return
        const isMismatch = Boolean(current.expectedSlug) && current.expectedSlug !== cottage.slug
        const key = isMismatch ? 'mobile:code.mismatch' : 'mobile:code.accepted'
        const params = { title: cottage.title }
        moveTo('success', { key, params })
        haptic('success')
        announce(current.t(key, params))
        current.onOutcome?.({ kind: result.isNew ? 'new' : 'found' })
        openTimer.current = setTimeout(
          () => {
            openTimer.current = null
            router.replace({ pathname: '/story/[slug]', params: { slug: cottage.slug, unlocked: result.isNew ? '1' : '0' } })
          },
          isMismatch ? MISMATCH_DELAY_MS : current.successDelayMs,
        )
      } catch {
        fail('failed')
      }
    },
    [fail, moveTo, router],
  )

  /* The held code goes through as soon as the lookup is ready; while it is
     not, the line says whether the app is still fetching or has given up. */
  useEffect(() => {
    if (phaseRef.current !== 'waiting') return
    if (lookupStatus === 'ready') {
      const code = heldCode.current
      heldCode.current = null
      phaseRef.current = 'idle'
      if (code) void submit(code)
      return
    }
    setMessage({ key: lookupStatus === 'error' ? 'mobile:code.lookupFailed' : 'mobile:code.waitingForLookup' })
  }, [lookupStatus, submit])

  const change = useCallback(
    (next: string) => {
      if (phaseRef.current === 'checking' || phaseRef.current === 'success') return
      const digits = next.replace(/\D/g, '').slice(0, CODE_LENGTH)
      stopClearing()
      heldCode.current = null
      setCode(digits)
      moveTo('idle', null)
      if (digits.length === CODE_LENGTH) {
        Keyboard.dismiss()
        void submit(digits)
      }
    },
    [moveTo, setCode, submit],
  )

  const reset = useCallback(() => {
    stopClearing()
    heldCode.current = null
    setCode('')
    moveTo('idle', null)
  }, [moveTo, setCode])

  /* A plaque link's code is submitted once per value, then taken off the
     route so a re-render or a return to the sheet does not resubmit it. */
  const handledParam = useRef<string | null>(null)
  useEffect(() => {
    if (!codeParam) {
      handledParam.current = null
      return
    }
    if (handledParam.current === codeParam) return
    handledParam.current = codeParam
    const digits = codeParam.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    void submit(digits)
    router.setParams({ code: undefined })
  }, [codeParam, setCode, submit, router])

  return {
    value,
    change,
    submit,
    phase,
    messageKey: message?.key ?? null,
    messageParams: message?.params,
    reset,
  }
}
