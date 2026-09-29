import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions, type FlatList, type LayoutChangeEvent } from 'react-native'
import Animated, { runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation, useRouter, type Href } from 'expo-router'
import { useTranslation } from 'react-i18next'
import logo from '../../../assets/logo.png'
import { announce } from '../../lib/announce'
import { haptic } from '../../lib/haptics'
import { markWelcomeSeen, useBoot } from '../../providers'
import {
  Button,
  CottageIcon,
  ElfIcon,
  ForwardIcon,
  KeyIcon,
  PageDots,
  SealIcon,
  TrailIcon,
  colors,
  iconSize,
  sizes,
  space,
  useReducedMotion,
  type Icon,
} from '../../ui'
import { CreedCard, ExpeditionNotes, GuideSteps, LoreCards, LoreIntro, TrailPhoto } from './LoreSections'

/* The onboarding: the site's lore and guide as four swipeable pages ending
   in the two ways to begin (open the Atlas, enter a code). In `first` mode it
   is the only screen of a fresh install and every way out sets the welcome
   flag, which flips the root's guard to the tabs; a route asked for on the
   way out (the code sheet, a plaque link's code) is left with the boot
   provider for the root to push once the tabs are mounted. In `replay` mode
   (Profile, How to play) it changes no flags and simply navigates. */

export type OnboardingPagerProps = {
  mode: 'first' | 'replay'
  /* Four digits from a plaque link opened before the first launch; carried
     into the code sheet on every exit. */
  code?: string
}

const PAGE_COUNT = 4
/* How much slower than the pages the emblems and the logo travel. */
const PARALLAX = 0.3

type PageSpec = { key: string; Emblem: Icon }

const PAGES: PageSpec[] = [
  { key: 'lore', Emblem: CottageIcon },
  { key: 'creed', Emblem: ElfIcon },
  { key: 'guide', Emblem: TrailIcon },
  { key: 'begin', Emblem: SealIcon },
]

export function OnboardingPager({ mode, code }: OnboardingPagerProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const navigation = useNavigation()
  const boot = useBoot()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const [width, setWidth] = useState(window.width)
  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  const listRef = useRef<FlatList>(null)
  const scrollX = useSharedValue(0)
  const first = mode === 'first'

  /* ---------- Leaving ---------- */

  /* A plaque code makes every exit open the code sheet with it. */
  const codeHref: Href | undefined = code ? { pathname: '/code', params: { code } } : undefined

  const finish = useCallback(
    (then?: Href) => {
      boot.setPendingHref(then ?? null)
      boot.setWelcomeSeen(true)
    },
    [boot],
  )

  const openAtlas = () => {
    if (first) finish(codeHref)
    else router.navigate('/')
  }

  const enterCode = () => {
    if (first) finish(codeHref ?? '/code')
    else router.push('/code')
  }

  /* Defensive: the route cannot be popped by the user in `first` mode, but
     if it ever is, the visit is still remembered. */
  useEffect(() => {
    if (!first) return
    return navigation.addListener('beforeRemove', () => {
      void markWelcomeSeen()
    })
  }, [first, navigation])

  /* ---------- Paging ---------- */

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x
  })

  const goTo = useCallback(
    (index: number) => {
      listRef.current?.scrollToOffset({ offset: index * width, animated: true })
    },
    [width],
  )

  const onPageChange = useCallback(
    (index: number) => {
      if (index === pageRef.current) return
      pageRef.current = index
      setPage(index)
      haptic('select')
      announce(t('mobile:welcome.pageAria', { index: index + 1, total: PAGE_COUNT }))
    },
    [t],
  )

  /* The page follows the scroll offset, so swipes, the Next button and the
     back key all report through one path. */
  useAnimatedReaction(
    () => (width > 0 ? Math.round(scrollX.value / width) : 0),
    (next, previous) => {
      if (next !== previous) runOnJS(onPageChange)(Math.min(PAGE_COUNT - 1, Math.max(0, next)))
    },
    [width, onPageChange],
  )

  /* Android back: the previous page; on the first page nothing to pop to in
     `first` mode, the native pop in `replay` mode. */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (pageRef.current > 0) {
          goTo(pageRef.current - 1)
          return true
        }
        return first
      })
      return () => subscription.remove()
    }, [first, goTo]),
  )

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    if (next > 0 && next !== width) setWidth(next)
  }

  /* The logo leaves with the first page: it slides at the parallax rate
     and fades, leaving the row to the Skip button. Static under reduced
     motion. */
  const parallax = !reducedMotion
  const logoStyle = useAnimatedStyle(() => {
    if (!parallax || width <= 0) return { opacity: 1, transform: [{ translateX: 0 }] }
    const progress = Math.min(1, Math.max(0, scrollX.value / width))
    return { opacity: 1 - progress, transform: [{ translateX: -progress * width * PARALLAX }] }
  })

  const lastPage = page === PAGE_COUNT - 1

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: (first ? insets.top : 0) + space.md }]}>
        <Animated.Image source={logo} style={[styles.logo, logoStyle]} resizeMode="contain" accessibilityIgnoresInvertColors />
        {first ? (
          <Button variant="subtle" onPress={() => finish(codeHref)}>
            {t('mobile:welcome.skip')}
          </Button>
        ) : null}
      </View>

      <Animated.FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(item: PageSpec) => item.key}
        renderItem={({ item, index }: { item: PageSpec; index: number }) => (
          <Page index={index} width={width} scrollX={scrollX} parallax={parallax} Emblem={item.Emblem}>
            {index === 0 ? <LoreIntro /> : null}
            {index === 1 ? (
              <>
                <CreedCard />
                <LoreCards />
              </>
            ) : null}
            {index === 2 ? (
              <>
                <GuideSteps />
                <TrailPhoto />
              </>
            ) : null}
            {index === 3 ? (
              <>
                <ExpeditionNotes />
                <View style={styles.actions}>
                  <Button variant="primary" block iconAfter={<ForwardIcon size={iconSize.md} color={colors.accentInk} />} onPress={openAtlas}>
                    {t('lore.openAtlas')}
                  </Button>
                  <Button block icon={<KeyIcon size={iconSize.md} color={colors.ink} />} onPress={enterCode}>
                    {t('nav.enterCode')}
                  </Button>
                </View>
              </>
            ) : null}
          </Page>
        )}
        getItemLayout={(_data: ArrayLike<PageSpec> | null | undefined, index: number) => ({ length: width, offset: width * index, index })}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onLayout={onLayout}
        style={styles.pager}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <PageDots count={PAGE_COUNT} scrollX={scrollX} pageWidth={width} />
        {lastPage ? null : (
          <Button variant="primary" onPress={() => goTo(Math.min(PAGE_COUNT - 1, pageRef.current + 1))}>
            {t('mobile:common.next')}
          </Button>
        )}
      </View>
    </View>
  )
}

/* One page: a vertical scroll so large text still fits, opened by a
   decorative emblem that lags behind the swipe. */
function Page({
  index,
  width,
  scrollX,
  parallax,
  Emblem,
  children,
}: {
  index: number
  width: number
  scrollX: SharedValue<number>
  parallax: boolean
  Emblem: Icon
  children: ReactNode
}) {
  const emblemStyle = useAnimatedStyle(() => {
    if (!parallax) return { transform: [{ translateX: 0 }] }
    const offset = Math.min(width, Math.max(-width, scrollX.value - index * width))
    return { transform: [{ translateX: offset * PARALLAX }] }
  })

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.page}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.emblem, emblemStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Emblem size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
      </Animated.View>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.page,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  logo: {
    width: 150,
    height: 120,
  },
  pager: {
    flex: 1,
  },
  page: {
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  emblem: {
    alignItems: 'flex-start',
  },
  actions: {
    gap: space.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.button + space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
})
