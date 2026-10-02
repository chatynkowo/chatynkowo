import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions, type FlatList, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation, useRouter, type Href } from 'expo-router'
import { useTranslation } from 'react-i18next'
import logo from '../../../assets/logo.png'
import { announce } from '../../lib/announce'
import { markWelcomeSeen, useBoot } from '../../providers'
import { Button, ForwardIcon, KeyIcon, PageDots, colors, iconSize, readable, space, useTabBarHeight } from '../../ui'
import { GuideTrail } from './GuideTrail'
import { CreedCard, ExpeditionNotes, GuideHeading, LoreIntro, LoreQuestions, TrailPhoto } from './LoreSections'

/* The onboarding: the site's lore and guide as four swipeable pages ending
   in the two ways to begin (open the Atlas, enter a code). Every page is its
   own scroll from the top of the screen, so nothing sits above the content
   but the safe area: the logo opens the first page's own content, and the
   dots, Skip and Next share the footer, which keeps one height on every
   page so the pages can lay themselves out to fill it. In `first` mode it
   is the only screen of a fresh install and every way out sets the welcome
   flag, which flips the root's guard to the tabs; a route asked for on the
   way out (the code sheet, a plaque link's code) is left with the boot
   provider for the root to push once the tabs are mounted. In `replay` mode
   (Profile, How to play) it sits under the native header and above the
   floating tab bar, changes no flags and simply navigates. */

export type OnboardingPagerProps = {
  mode: 'first' | 'replay'
  /* Four digits from a plaque link opened before the first launch; carried
     into the code sheet on every exit. */
  code?: string
}

/* The lore; the four questions and the creed; the guide as a trail spread
   over its page; the photo, the notes and the ways to begin. */
const PAGE_KEYS = ['lore', 'questions', 'guide', 'begin'] as const
const PAGE_COUNT = PAGE_KEYS.length
/* How close to a page boundary (in pages) the offset must rest to count as
   landed. Android pages in whole pixels while the width is rounded dp, so
   page k rests a dp or two off k * width; the tolerance is ~20 dp. */
const SETTLE_TOLERANCE = 0.05
export function OnboardingPager({ mode, code }: OnboardingPagerProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const navigation = useNavigation()
  const boot = useBoot()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useTabBarHeight()
  const window = useWindowDimensions()
  const [width, setWidth] = useState(window.width)
  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  /* The page a programmatic scroll is heading for (the landed page
     otherwise), so a quick second tap on Next counts from it. */
  const targetRef = useRef(0)
  const listRef = useRef<FlatList>(null)
  const scrollX = useSharedValue(0)
  const dragging = useSharedValue(false)
  /* The page a programmatic scroll is flying to, -1 when none: a second
     tap on Next mid-flight sweeps through a page that must not report. */
  const flyingTo = useSharedValue(-1)
  const first = mode === 'first'

  /* ---------- Leaving ---------- */

  /* A plaque code makes every exit open the code sheet with it. */
  const codeHref: Href | undefined = code ? { pathname: '/code', params: { code } } : undefined

  const finish = useCallback(
    (then?: Href) => {
      boot.setPendingHref(then ?? null)
      boot.markWelcomeSeen()
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

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x
    },
    onBeginDrag: () => {
      dragging.value = true
      /* The finger takes over from any programmatic scroll. */
      flyingTo.value = -1
    },
    onEndDrag: () => {
      dragging.value = false
    },
    /* A safety net for a drag whose end was never reported (a cancelled
       touch): the snap that follows always ends with momentum. */
    onMomentumEnd: () => {
      dragging.value = false
    },
  })

  const goTo = useCallback(
    (index: number) => {
      targetRef.current = index
      flyingTo.value = index
      listRef.current?.scrollToOffset({ offset: index * width, animated: true })
    },
    [width],
  )

  const onPageChange = useCallback(
    (index: number) => {
      targetRef.current = index
      if (index === pageRef.current) return
      pageRef.current = index
      setPage(index)
      announce(t('mobile:welcome.pageAria', { index: index + 1, total: PAGE_COUNT }))
    },
    [t],
  )

  /* The page follows the scroll offset, so swipes, the Next button and the
     back key all report through one path, and only once the offset has
     landed on a page with the finger lifted: nothing is announced while the
     pages slide, and a swipe pulled back to where it started reports
     nothing new. -1 is "between pages". */
  useAnimatedReaction(
    () => {
      if (width <= 0 || dragging.value) return -1
      const exact = scrollX.value / width
      const nearest = Math.round(exact)
      if (Math.abs(exact - nearest) >= SETTLE_TOLERANCE) return -1
      const landed = Math.min(PAGE_COUNT - 1, Math.max(0, nearest))
      /* A programmatic scroll may pass through a page on the way; only its
         destination counts. */
      if (flyingTo.value >= 0 && landed !== flyingTo.value) return -1
      return landed
    },
    (next, previous) => {
      if (next < 0 || next === previous) return
      if (next === flyingTo.value) flyingTo.value = -1
      scheduleOnRN(onPageChange, next)
    },
    [width, onPageChange],
  )

  /* Android back: the previous page; on the first page nothing to pop to in
     `first` mode, the native pop in `replay` mode. */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (targetRef.current > 0) {
          goTo(targetRef.current - 1)
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

  /* ---------- Layout ---------- */

  /* Where a page's content starts: under the status bar without a header,
     under the opaque native header of the replay only the page's own margin.
     The footer ends above the home indicator, or above the floating tab bar
     in the replay. */
  const pageTop = first ? insets.top + space.xl : space.xl
  const footerBottom = (first ? insets.bottom : tabBarHeight || insets.bottom) + space.lg

  const pages: Record<(typeof PAGE_KEYS)[number], ReactNode> = {
    lore: (
      <>
        <Image source={logo} style={styles.logo} contentFit="contain" accessible={false} />
        <LoreIntro />
      </>
    ),
    questions: (
      <>
        <LoreQuestions fill />
        <CreedCard />
      </>
    ),
    guide: (
      <>
        <GuideHeading />
        <GuideTrail fill />
      </>
    ),
    begin: (
      <>
        <TrailPhoto />
        <View style={styles.begin}>
          <ExpeditionNotes />
          <View style={styles.actions}>
            <Button variant="primary" block iconAfter={<ForwardIcon size={iconSize.md} color={colors.accentInk} />} onPress={openAtlas}>
              {t('lore.openAtlas')}
            </Button>
            <Button block icon={<KeyIcon size={iconSize.md} color={colors.ink} />} onPress={enterCode}>
              {t('nav.enterCode')}
            </Button>
          </View>
        </View>
      </>
    ),
  }

  const lastPage = page === PAGE_COUNT - 1

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        data={PAGE_KEYS}
        keyExtractor={(key: (typeof PAGE_KEYS)[number]) => key}
        renderItem={({ item, index }: { item: (typeof PAGE_KEYS)[number]; index: number }) => (
          <Page width={width} paddingTop={pageTop}>
            {pages[item]}
          </Page>
        )}
        getItemLayout={(_data: ArrayLike<(typeof PAGE_KEYS)[number]> | null | undefined, index: number) => ({ length: width, offset: width * index, index })}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onLayout={onLayout}
        style={styles.pager}
      />

      <View style={[styles.footer, { paddingBottom: footerBottom }]}>
        <PageDots count={PAGE_COUNT} scrollX={scrollX} pageWidth={width} />
        {/* On the last page the page's own buttons take over, and these stay
            mounted but invisible and inert: the footer keeps their real height
            at every text size, so the pager never changes height mid-swipe. */}
        <View
          style={[styles.footerActions, lastPage && styles.footerActionsHidden]}
          pointerEvents={lastPage ? 'none' : 'auto'}
          accessibilityElementsHidden={lastPage}
          importantForAccessibility={lastPage ? 'no-hide-descendants' : 'auto'}
        >
          {first ? (
            <Button variant="subtle" onPress={() => finish(codeHref)}>
              {t('mobile:welcome.skip')}
            </Button>
          ) : null}
          <Button variant="primary" onPress={() => goTo(Math.min(PAGE_COUNT - 1, targetRef.current + 1))}>
            {t('mobile:common.next')}
          </Button>
        </View>
      </View>
    </View>
  )
}

/* One page: a vertical scroll from the top of the screen, so large text
   still fits; at the default size the content fills the page, so a page
   can spread its trail or sink its buttons to the bottom. */
function Page({ width, paddingTop, children }: { width: number; paddingTop: number; children: ReactNode }) {
  return (
    <ScrollView style={{ width }} contentContainerStyle={[styles.page, { paddingTop }]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.page,
  },
  pager: {
    flex: 1,
  },
  page: {
    ...readable,
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  logo: {
    width: 150,
    height: 120,
  },
  /* The notes and the buttons sink to the bottom of the last page. */
  begin: {
    marginTop: 'auto',
    gap: space.xl,
  },
  actions: {
    gap: space.sm,
  },
  footer: {
    ...readable,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  footerActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  footerActionsHidden: {
    opacity: 0,
  },
})
