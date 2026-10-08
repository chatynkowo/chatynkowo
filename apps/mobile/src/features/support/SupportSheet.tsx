import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { STORE_NAME } from '../../lib/billing'
import { useCloseModal, useOnline, useSupport } from '../../providers'
import { Button, CoffeeIcon, PressableScale, SheetRoute, Text, WatchAdIcon, colors, iconSize, radius, space } from '../../ui'
import { DEFAULT_TIP, tipLabelKey } from './tips'
import { useRewardedSupportAd, type RewardedAdStatus } from './useRewardedSupportAd'
import { useSupportLedger } from './useSupportLedger'

/* The support sheet (the route /support), opened by the support card
   (SupportCard.tsx: a tale's end, the Kronika, the profile) and the
   celebration card: the two voluntary ways to support Chatynkowo, side
   by side and equal. A coffee for the elf is a purchase through the store
   the app came from (SupportProvider holds the connection and the menu
   with the store's prices; the store's own payment sheet takes the
   payment). An ad is a rewarded ad the player asks for and watches to
   the end, which the ad network confirms. Either way the receipt is the
   provider's: the ledger counts it and a toast says thanks; this sheet
   only closes when it hears of one. Nothing
   is unlocked by either, and the sheet says so. A build that cannot
   reach its store, or an ad unit, says that way is not available. */

export function SupportSheet() {
  const { t } = useTranslation()
  const close = useCloseModal()
  const online = useOnline()
  const support = useSupport()
  const ledger = useSupportLedger()
  const [tip, setTip] = useState<string | null>(null)

  useEffect(() => support.onReceived(() => close()), [support, close])

  const ad = useRewardedSupportAd(support.receiveAd)

  /* The default size, or the first one the store sells. */
  const chosen = tip ?? support.menu.find((item) => item.tip.id === DEFAULT_TIP)?.product.id ?? support.menu[0]?.product.id ?? null

  const coffeeNote = coffeeNoteKey(support, online)
  const adNote = adNoteKey(ad.status, online)
  const given = [
    ledger.coffees > 0 ? t('mobile:support.ledgerCoffees', { count: ledger.coffees }) : null,
    ledger.ads > 0 ? t('mobile:support.ledgerAds', { count: ledger.ads }) : null,
  ].filter(Boolean)

  return (
    <SheetRoute scroll>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:support.eyebrow')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:support.title')}
          </Text>
          <Text tone="soft">{t('mobile:support.lead')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <CoffeeIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            <Text variant="heading" accessibilityRole="header">
              {t('mobile:support.coffeeTitle')}
            </Text>
          </View>
          {support.status === 'connecting' ? (
            <ActivityIndicator color={colors.accentStrong} accessibilityLabel={t('mobile:support.coffeeConnecting')} style={styles.spinner} />
          ) : support.status === 'unavailable' ? (
            <Text variant="small" tone="faint">
              {t('mobile:support.coffeeUnavailable')}
            </Text>
          ) : (
            <>
              <Text variant="small" tone="soft">
                {t('mobile:support.coffeeLead', { store: STORE_NAME })}
              </Text>
              <View style={styles.menu} accessibilityRole="radiogroup">
                {support.menu.map(({ tip: entry, product }) => {
                  const selected = product.id === chosen
                  const label = t(tipLabelKey(entry.id))
                  return (
                    <PressableScale
                      key={product.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={t('mobile:support.tipChoiceAria', { label, amount: product.displayPrice })}
                      onPress={() => setTip(product.id)}
                      style={[styles.option, selected && styles.optionSelected]}
                    >
                      <Text weight="bold" numberOfLines={1}>
                        {product.displayPrice}
                      </Text>
                      <Text variant="small" tone={selected ? 'accent' : 'soft'} numberOfLines={1}>
                        {label}
                      </Text>
                    </PressableScale>
                  )
                })}
              </View>
              <Button
                variant="primary"
                block
                busy={support.buying !== null}
                disabled={online === false || chosen === null}
                icon={<CoffeeIcon size={iconSize.md} weight="fill" color={colors.accentInk} />}
                onPress={() => {
                  if (chosen) support.buy(chosen)
                }}
              >
                {t('mobile:support.tipAction')}
              </Button>
              {coffeeNote ? (
                <Text variant="small" tone="faint" accessibilityLiveRegion="polite">
                  {t(coffeeNote)}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <WatchAdIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            <Text variant="heading" accessibilityRole="header">
              {t('mobile:support.adTitle')}
            </Text>
          </View>
          {ad.offered ? (
            <>
              <Text variant="small" tone="soft">
                {t('mobile:support.adLead')}
              </Text>
              <Button
                block
                busy={ad.status === 'loading' || ad.status === 'showing'}
                disabled={online === false}
                icon={<WatchAdIcon size={iconSize.md} color={colors.accentStrong} />}
                onPress={ad.watch}
              >
                {t('mobile:support.adAction')}
              </Button>
              {adNote ? (
                <Text variant="small" tone="faint" accessibilityLiveRegion="polite">
                  {t(adNote)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="small" tone="faint">
              {t('mobile:support.adNotInBuild')}
            </Text>
          )}
        </View>

        {given.length ? (
          <Text variant="small" tone="soft" align="center">
            {t('mobile:support.ledgerTitle')}: {given.join(', ')}
          </Text>
        ) : null}
        <Text variant="small" tone="faint" align="center">
          {t('mobile:support.note')}
        </Text>
      </View>
    </SheetRoute>
  )
}

/* What the coffee card says under its button: the network first, then a
   payment the store still waits for, then the last failed attempt. */
function coffeeNoteKey(support: ReturnType<typeof useSupport>, online: boolean | null): string | null {
  if (online === false) return 'mobile:support.coffeeOffline'
  if (support.pending) return 'mobile:support.coffeePending'
  if (support.failure === 'network') return 'mobile:support.coffeeFailedNetwork'
  if (support.failure === 'store') return 'mobile:support.coffeeFailed'
  return null
}

/* What the ad card says under its button: the network first, then where
   the last request ended. */
function adNoteKey(status: RewardedAdStatus, online: boolean | null): string | null {
  if (online === false) return 'mobile:support.adOffline'
  switch (status) {
    case 'loading':
    case 'showing':
      return 'mobile:support.adLoading'
    case 'unavailable':
    case 'error':
      return 'mobile:support.adUnavailable'
    case 'refused':
      return 'mobile:support.adRefused'
    case 'dismissed':
      return 'mobile:support.adDismissed'
    default:
      return null
  }
}

const styles = StyleSheet.create({
  column: {
    gap: space.xl,
    paddingTop: space.sm,
  },
  head: {
    gap: space.xs,
  },
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  spinner: {
    paddingVertical: space.md,
  },
  /* The menu as two columns of two. */
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  option: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 2,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.pageRaised,
  },
  optionSelected: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentWash,
  },
})
