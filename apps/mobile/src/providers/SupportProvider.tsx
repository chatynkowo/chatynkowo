import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TIP_MENU, TIP_PRODUCT_IDS, tipForProduct, type Tip } from '../features/support/tips'
import { connectBilling, type BillingConnection, type BillingEvent, type StoreProduct } from '../lib/billing'
import { recordSupport, type SupportKind } from '../lib/support-store'
import { useForeground } from './NetworkProvider'
import { useToast } from './ToastProvider'

/* The coffee for the elf, for the whole app: the store connection opens
   when the app starts and stays, so a purchase the store settles outside
   the support sheet (a payment confirmed later, a purchase left
   unfinished by a crash) is finished and thanked for wherever the player
   is. The sheet reads the menu with the store's prices from here and
   asks for a purchase; the receipt of either kind of support (a paid
   coffee, an ad watched to the end) is given here too, the same way:
   the ledger counts it and a toast says thanks. Listeners of
   `onReceived` (the sheet) learn of it to close themselves. */

export type CoffeeMenuItem = { tip: Tip; product: StoreProduct }

export type CoffeeStoreStatus =
  | 'connecting'
  /* The store cannot be reached, or knows none of the products. */
  | 'unavailable'
  | 'ready'

export type SupportValue = {
  status: CoffeeStoreStatus
  /* The coffees the store sells, in the menu's order, with their prices. */
  menu: CoffeeMenuItem[]
  /* The product being bought, while the store's sheet is up. */
  buying: string | null
  /* A purchase the store is still waiting to be paid (cash, Ask to Buy). */
  pending: boolean
  /* The last purchase that did not go through, until the next attempt. */
  failure: 'network' | 'store' | null
  buy: (productId: string) => void
  /* The receipt of an ad watched to the end (the ad itself lives in the
     sheet's hook). */
  receiveAd: () => void
  onReceived: (listener: (kind: SupportKind) => void) => () => void
}

const SupportContext = createContext<SupportValue | null>(null)

export function SupportProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [status, setStatus] = useState<CoffeeStoreStatus>('connecting')
  const [menu, setMenu] = useState<CoffeeMenuItem[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<SupportValue['failure']>(null)
  const connection = useRef<BillingConnection | null>(null)
  const listeners = useRef(new Set<(kind: SupportKind) => void>())

  const received = useCallback(
    (kind: SupportKind) => {
      recordSupport(kind)
      toast.show({ tone: 'success', text: t('mobile:support.thanksToast') })
      for (const listener of listeners.current) listener(kind)
    },
    [toast, t],
  )
  const receivedRef = useRef(received)
  useEffect(() => {
    receivedRef.current = received
  }, [received])

  const onEvent = useCallback((event: BillingEvent) => {
    setBuying(null)
    switch (event.kind) {
      case 'paid':
        if (tipForProduct(event.productId)) {
          setPending(false)
          setFailure(null)
          receivedRef.current('coffee')
        }
        return
      case 'pending':
        setPending(true)
        setFailure(null)
        return
      case 'cancelled':
        return
      case 'failed':
        setFailure(event.reason)
    }
  }, [])

  /* The connection for the life of the provider; the leftovers settled
     once it is open and on every return to the foreground. */
  useEffect(() => {
    let current = true
    void connectBilling(TIP_PRODUCT_IDS, onEvent)
      .then((opened) => {
        if (!current) {
          opened.close()
          return
        }
        connection.current = opened
        const items = TIP_MENU.flatMap((tip) => {
          const product = opened.products.find((candidate) => candidate.id === tip.productId)
          return product ? [{ tip, product }] : []
        })
        setMenu(items)
        setStatus(items.length ? 'ready' : 'unavailable')
        void opened.settleLeftovers().catch((error) => console.warn('[support] leftovers', error))
      })
      .catch((error) => {
        if (__DEV__) console.warn('[support] store', error)
        if (current) setStatus('unavailable')
      })
    return () => {
      current = false
      connection.current?.close()
      connection.current = null
    }
  }, [onEvent])

  useForeground(() => {
    void connection.current?.settleLeftovers().catch((error) => console.warn('[support] leftovers', error))
  })

  const buy = useCallback((productId: string) => {
    const opened = connection.current
    if (!opened || !tipForProduct(productId)) return
    setFailure(null)
    setBuying(productId)
    void opened.buy(productId)
  }, [])

  const receiveAd = useCallback(() => received('ad'), [received])

  const onReceived = useCallback((listener: (kind: SupportKind) => void) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const value = useMemo<SupportValue>(
    () => ({ status, menu, buying, pending, failure, buy, receiveAd, onReceived }),
    [status, menu, buying, pending, failure, buy, receiveAd, onReceived],
  )

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>
}

export function useSupport(): SupportValue {
  const value = useContext(SupportContext)
  if (!value) throw new Error('useSupport must be used within SupportProvider')
  return value
}
