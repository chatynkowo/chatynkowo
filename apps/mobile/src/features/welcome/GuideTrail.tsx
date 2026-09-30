import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { Text, TrailIcon, colors, iconSize, space } from '../../ui'

/* The guide's four steps drawn as a trail on a map: a footprint marker per
   step, alternating left and right of the column, with the number and the
   title on one line and the body under them, and a dashed path winding from
   one marker to the next behind them. Inside a row the path runs straight
   under its marker's column; it crosses to the other bank only in the gap
   between two rows, so it never passes over the words at any text size.
   The rows are measured, so the path follows wherever the text lands. Shown
   on the onboarding's guide page and on the profile's About screen. */

const STEP_COUNT = 4
const MARKER = 40
const STROKE = 2
const DASH = '6 8'
/* The gap between rows is where the trail switches banks. */
const ROW_GAP = space.xl

type Size = { width: number; height: number }
type Band = { top: number; bottom: number }

export function GuideTrail() {
  const { t } = useTranslation()
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  /* Each step's row, in the trail's coordinates. */
  const [bands, setBands] = useState<Band[]>(() => Array.from({ length: STEP_COUNT }, () => ({ top: 0, bottom: 0 })))

  const steps = Array.from({ length: STEP_COUNT }, (_, index) => ({
    number: String(index + 1).padStart(2, '0'),
    title: t(`guide.step${index + 1}Title`),
    body: t(`guide.step${index + 1}Body`),
  }))

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
  }

  const placeRow = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout
    setBands((current) => {
      const band = current[index]
      if (band && band.top === y && band.bottom === y + height) return current
      const next = [...current]
      next[index] = { top: y, bottom: y + height }
      return next
    })
  }, [])

  const path = useMemo(() => trailPath(size, bands), [size, bands])

  return (
    <View style={styles.trail} onLayout={onLayout} accessibilityRole="list">
      {path ? (
        <Svg
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Path d={path} stroke={colors.lineStrong} strokeWidth={STROKE} strokeDasharray={DASH} strokeLinecap="round" fill="none" />
        </Svg>
      ) : null}
      {steps.map((step, index) => {
        const right = index % 2 === 1
        const align = right ? 'right' : 'left'
        return (
          <View key={step.number} style={[styles.step, right && styles.stepRight]} onLayout={(event) => placeRow(index, event)}>
            <View style={styles.marker} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <TrailIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
            </View>
            <View style={[styles.text, right && styles.textRight]}>
              <Text weight="bold" align={align}>
                <Text variant="eyebrow">{step.number}</Text>
                {'  '}
                {step.title}
              </Text>
              <Text variant="small" tone="soft" align={align}>
                {step.body}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

/* The trail as an SVG path: a straight run under each marker's column from
   the row's top edge to its bottom edge, joined to the next row by a curve
   through the gap that carries it to the other bank, entering from the top
   edge above the first row and leaving through the bottom edge. Empty until
   every row has been measured. */
function trailPath({ width, height }: Size, bands: Band[]): string {
  if (width <= 0 || bands.some((band) => band.bottom <= band.top)) return ''
  const column = (index: number) => (index % 2 === 1 ? width - MARKER / 2 : MARKER / 2)
  const first = bands[0]
  const segments = [`M ${column(0)} 0`, `L ${column(0)} ${first.bottom}`]
  for (let index = 1; index < bands.length; index += 1) {
    const from = { x: column(index - 1), y: bands[index - 1].bottom }
    const to = { x: column(index), y: bands[index].top }
    /* Vertical tangents at both ends: the run bends into the gap and out of
       it, and the crossing is level in the middle of the gap. */
    const bend = (to.y - from.y) * 0.6
    segments.push(`C ${from.x} ${from.y + bend} ${to.x} ${to.y - bend} ${to.x} ${to.y}`, `L ${to.x} ${bands[index].bottom}`)
  }
  segments.push(`L ${column(bands.length - 1)} ${height}`)
  return segments.join(' ')
}

const styles = StyleSheet.create({
  trail: {
    gap: ROW_GAP,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stepRight: {
    flexDirection: 'row-reverse',
  },
  marker: {
    width: MARKER,
    height: MARKER,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: MARKER / 2,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: space.xs,
  },
  textRight: {
    alignItems: 'flex-end',
  },
})
