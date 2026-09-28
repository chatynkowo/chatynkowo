import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconButton } from './Button'
import { CloseIcon, iconSize } from './icons'
import { Text } from './Text'
import { colors, radius, space } from './tokens'

/* The app's one dialog, the counterpart of the site's Modal: a backdrop, a
   card that slides up from the bottom (or sits in the centre), a close
   control and the hardware back button wired to `onClose`. Mount it with
   `visible` and give it a `closeLabel` for assistive tech; the title, when
   given, is announced as the dialog's name. */

export type SheetProps = {
  visible: boolean
  onClose: () => void
  closeLabel: string
  title?: string
  eyebrow?: string
  presentation?: 'bottom' | 'center'
  /* The card scrolls its content; off for content that scrolls itself. */
  scroll?: boolean
  children: ReactNode
}

export function Sheet({ visible, onClose, closeLabel, title, eyebrow, presentation = 'bottom', scroll = true, children }: SheetProps) {
  const insets = useSafeAreaInsets()
  const bottom = presentation === 'bottom'
  const body = (
    <>
      {(eyebrow || title) && (
        <View style={styles.header}>
          {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
          {title ? (
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
        </View>
      )}
      {children}
    </>
  )

  return (
    <Modal visible={visible} transparent animationType={bottom ? 'slide' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      {/* A translucent-status-bar modal is not resized for the keyboard on
          Android, so the layer pads itself instead; iOS needs the same. */}
      <KeyboardAvoidingView behavior="padding" style={[styles.layer, bottom ? styles.layerBottom : styles.layerCenter]}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} style={styles.backdrop} onPress={onClose} />
        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.card,
            bottom ? { ...styles.cardBottom, paddingBottom: Math.max(insets.bottom, space.lg) } : styles.cardCenter,
          ]}
        >
          <IconButton label={closeLabel} onPress={onClose} style={styles.close}>
            <CloseIcon size={iconSize.lg} color={colors.ink} />
          </IconButton>
          {scroll ? (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {body}
            </ScrollView>
          ) : (
            <View style={[styles.content, styles.contentFlex]}>{body}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
  },
  layerBottom: {
    justifyContent: 'flex-end',
  },
  layerCenter: {
    justifyContent: 'center',
    padding: space.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backdrop,
  },
  card: {
    backgroundColor: colors.pageRaised,
    borderColor: colors.lineStrong,
    borderWidth: 1,
    maxHeight: '88%',
  },
  cardBottom: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderBottomWidth: 0,
  },
  cardCenter: {
    borderRadius: radius.card,
  },
  close: {
    position: 'absolute',
    zIndex: 2,
    top: space.lg,
    right: space.lg,
  },
  content: {
    padding: space.xl,
    paddingTop: space.xl + space.md,
    gap: space.md,
  },
  contentFlex: {
    flexShrink: 1,
  },
  header: {
    gap: space.xs,
    paddingRight: 48,
  },
})
