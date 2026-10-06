import { Platform } from 'react-native'
import {
  ErrorCode,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Product,
  type ExpoPurchaseError as PurchaseError,
  type Purchase,
} from 'expo-iap'

/* The app's store billing (Google Play Billing on Android, StoreKit 2 on
   iOS, through expo-iap), used for one thing: the coffee for the elf, a
   consumable product per size (src/features/support/tips.ts). This is
   the only module that talks to the store; SupportProvider drives it the
   way the stores ask:
   - the purchase listeners are registered before the connection opens
     and stay for the life of the app, so a purchase settled outside the
     app (a payment confirmed later, Ask to Buy approved) still arrives;
   - every purchase the store reports as paid is finished (consumed on
     Android, finished on iOS) at once, and the ones left unfinished by a
     crash or a kill are settled on the next launch and every return to
     the foreground, because Google refunds a purchase not acknowledged
     within three days and Apple keeps re-sending one not finished;
   - a purchase the store reports as pending (a cash payment, Ask to Buy)
     is never finished and never counted; it comes back through the
     listener once it is paid.
   Prices come from the store's own product records, in the player's
   currency; the app carries only the product ids. */

/* The store the build sells through, by name, for the copy. */
export const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play'

export type StoreProduct = Product

export type BillingEvent =
  /* The store took the payment; the purchase has been finished. */
  | { kind: 'paid'; productId: string; transactionId: string }
  /* The store is waiting for the payment (cash, Ask to Buy). */
  | { kind: 'pending'; productId: string }
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: 'network' | 'store' }

type Listener = (event: BillingEvent) => void

/* Transactions already finished in this process, so a purchase the store
   reports twice (the listener and the leftovers query) counts once. */
const settled = new Set<string>()

function transactionKey(purchase: Purchase): string {
  return purchase.purchaseToken ?? purchase.id
}

/* A paid purchase is finished with the store and reported once; a
   pending one is reported as such and left alone. */
async function settle(purchase: Purchase, listener: Listener): Promise<void> {
  if (purchase.purchaseState === 'pending') {
    listener({ kind: 'pending', productId: purchase.productId })
    return
  }
  if (purchase.purchaseState !== 'purchased') return
  const key = transactionKey(purchase)
  if (settled.has(key)) return
  settled.add(key)
  try {
    await finishTransaction({ purchase, isConsumable: true })
  } catch (error) {
    /* Not finished: the store will hand it over again (the next launch's
       leftovers), so it is not counted yet either. */
    settled.delete(key)
    console.warn('[billing] finish', error)
    return
  }
  listener({ kind: 'paid', productId: purchase.productId, transactionId: purchase.id })
}

const NETWORK_REASONS: ReadonlySet<string> = new Set([ErrorCode.NetworkError, ErrorCode.ServiceTimeout, ErrorCode.ServiceDisconnected, ErrorCode.ConnectionClosed, ErrorCode.RemoteError])

function report(error: PurchaseError, listener: Listener): void {
  const code = error.code ?? ErrorCode.Unknown
  switch (code) {
    case ErrorCode.UserCancelled:
      listener({ kind: 'cancelled' })
      return
    case ErrorCode.DeferredPayment:
    case ErrorCode.Pending:
      listener({ kind: 'pending', productId: error.productId ?? '' })
      return
    default:
      console.warn('[billing] purchase', code, error.message)
      listener({ kind: 'failed', reason: NETWORK_REASONS.has(code) ? 'network' : 'store' })
  }
}

export type BillingConnection = {
  /* The products the store knows among the ids asked for, in the order
     asked for; empty when the store has none of them. */
  products: StoreProduct[]
  /* Finishes what the store still holds as paid and unfinished, and
     reports pending ones; for the launch and every return to the
     foreground. */
  settleLeftovers: () => Promise<void>
  buy: (productId: string) => Promise<void>
  close: () => void
}

/* Opens the store connection with the listeners in place, reads the
   products and returns the handle; throws when the store cannot be
   reached (no Play services, a device without a store). */
export async function connectBilling(productIds: readonly string[], listener: Listener): Promise<BillingConnection> {
  /* A request whose outcome has not been reported yet: a store that both
     rejects the request and emits the error reports it once. */
  let awaiting = false
  const deliver: Listener = (event) => {
    awaiting = false
    listener(event)
  }
  const subscriptions = [
    purchaseUpdatedListener((purchase) => {
      void settle(purchase, deliver)
    }),
    purchaseErrorListener((error) => report(error, deliver)),
  ]
  const close = () => {
    for (const subscription of subscriptions) subscription.remove()
    void endConnection().catch(() => undefined)
  }
  try {
    const connected = await initConnection()
    if (!connected) throw new Error('store connection refused')
    const known = ((await fetchProducts({ skus: [...productIds], type: 'in-app' })) ?? []) as StoreProduct[]
    const products = productIds.map((id) => known.find((product) => product.id === id)).filter((product): product is StoreProduct => Boolean(product))
    return {
      products,
      settleLeftovers: async () => {
        const leftovers = await getAvailablePurchases()
        for (const purchase of leftovers) await settle(purchase, deliver)
      },
      buy: async (productId) => {
        awaiting = true
        try {
          /* The outcome arrives through the listeners; the promise only
             says the request reached the store. */
          await requestPurchase({ request: { apple: { sku: productId }, google: { skus: [productId] } }, type: 'in-app' })
        } catch (error) {
          /* A rejection the listener has not reported (the request never
             left, or a store that only rejects) is reported here. */
          if (awaiting) report(error as PurchaseError, deliver)
        }
      },
      close,
    }
  } catch (error) {
    close()
    throw error
  }
}
