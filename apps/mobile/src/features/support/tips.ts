/* The coffee for the elf: a consumable product per size, sold through the
   store the build came from (Google Play Billing, the App Store), so the
   payment never leaves the app. The app carries only the product ids;
   the names are the dictionary's (support.tip<Id>), the prices are the
   store's own, in the player's currency, read with the products. The
   same ids must exist in both consoles (see "Supporting Chatynkowo" in
   the README). Nothing here reaches the elf's rules: a coffee changes
   nothing in the game. */

export type TipId = 'small' | 'regular' | 'large' | 'pot'

export type Tip = {
  id: TipId
  /* The product id in Google Play Console and App Store Connect. */
  productId: string
}

export const TIP_MENU: readonly Tip[] = [
  { id: 'small', productId: 'coffee_small' },
  { id: 'regular', productId: 'coffee_regular' },
  { id: 'large', productId: 'coffee_large' },
  { id: 'pot', productId: 'coffee_pot' },
]

export const TIP_PRODUCT_IDS: readonly string[] = TIP_MENU.map((tip) => tip.productId)

export const DEFAULT_TIP: TipId = 'regular'

export function tipForProduct(productId: string): Tip | undefined {
  return TIP_MENU.find((tip) => tip.productId === productId)
}

/* The dictionary key of a tip's name (support.tipSmall, ...). */
export function tipLabelKey(id: TipId): string {
  return `mobile:support.tip${id.charAt(0).toUpperCase()}${id.slice(1)}`
}
