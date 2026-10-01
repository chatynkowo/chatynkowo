import { useCallback, useRef, type ReactNode } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView, useBottomSheetSpringConfigs, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { useCloseModal } from '../providers'
import { SPRINGS } from './motion'
import { colors, radius, space } from './tokens'

/* The sheet a route rises in over the screen beneath: the code gate, a
   reward, the rules. One base, the same component as the Atlas's cottage
   panel, so every sheet drags, scrolls and closes alike: it opens at its
   own height (or the part of the screen it asks for) and can be pulled to
   the top; a scroll inside moves the content first and the sheet only at
   its top edge; a drag down past the first stop, a tap on the scrim or the
   back button closes it, and the route goes back. The route itself is a
   transparent modal with no animation of its own. */

export type SheetRouteProps = {
  /* Where the sheet may rest beyond its content: the top for every sheet,
     and a share of the screen before it for one that opens part-way. */
  snapPoints?: Array<string | number>
  /* Sized to its content, which then is the first stop; off for a sheet
     that opens part-way and scrolls inside. */
  fit?: boolean
  /* The content scrolls inside the sheet (a long reward description). */
  scroll?: boolean
  /* The sheet has settled at its first stop: the moment to focus a field,
     so the keyboard finds a sheet to extend (one that rose before the
     sheet existed goes unnoticed). */
  onPresented?: () => void
  children: ReactNode
}

const BACKDROP_OPACITY = 0.55

function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={BACKDROP_OPACITY} pressBehavior="close" />
}

export function SheetRoute({ snapPoints = ['100%'], fit = true, scroll = false, onPresented, children }: SheetRouteProps) {
  const insets = useSafeAreaInsets()
  const close = useCloseModal()
  const sheet = useRef<BottomSheet>(null)
  const presented = useRef(false)
  const onChange = useCallback(
    (index: number) => {
      if (index < 0 || presented.current) return
      presented.current = true
      onPresented?.()
    },
    [onPresented],
  )
  const springs = useBottomSheetSpringConfigs(SPRINGS.settle)

  /* Android back lets the sheet leave first; the route goes back once it
     has closed. */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        sheet.current?.close()
        return true
      })
      return () => subscription.remove()
    }, []),
  )

  const content = { paddingBottom: insets.bottom + space.lg }
  return (
    <View style={StyleSheet.absoluteFill}>
      <BottomSheet
        ref={sheet}
        snapPoints={snapPoints}
        enableDynamicSizing={fit}
        enablePanDownToClose
        topInset={insets.top}
        animationConfigs={springs}
        backdropComponent={Backdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        /* A keyboard (the code gate) extends the sheet to the top, so everything
           it holds stays above the keys; it settles back when the keys go. */
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={onChange}
        onClose={close}
      >
        {scroll ? (
          <BottomSheetScrollView contentContainerStyle={[styles.content, content]} showsVerticalScrollIndicator={false}>
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[styles.content, content]}>{children}</BottomSheetView>
        )}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.pageRaised,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.lineStrong,
  },
  content: {
    paddingHorizontal: space.lg,
  },
})
