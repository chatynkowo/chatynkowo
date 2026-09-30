import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { Text, TrailIcon, colors, iconSize, space } from '../../ui'
import { DISC, Disc } from './Disc'

/* The guide's four steps drawn as a trail on a map: a footprint disc per
   step, alternating left and right of the column, with the number and the
   title on one line and a short line under them, and a dashed path winding
   from one disc to the next behind them. The number and the title are two
   texts on one baseline, not one nested run: iOS takes a line's height from
   its first character, so the small number in front capped the line and
   clipped the tops of the title. Inside a row the path runs straight under
   its disc's column; it crosses to the other bank only in the gap between
   two rows, so it never passes over the words at any text size. The rows
   are measured, so the path follows wherever the text lands. Shown on the
   onboarding's guide page, where it takes the rest of the page and the path
   runs from under the title to the footer, and on the profile's About
   screen at its natural height. */

type GuideTrailProps = {
  /* Grow into the height the parent gives and spread the steps over it. */
  fill?: boolean
}

const STEP_COUNT = 4
const STROKE = 2
const DASH = '6 8'
/* The least room between two rows: the crossing to the other bank lives
   there and needs this much height to read as a curve rather than a jog;
   the fill mode spreads the rows wider than this. */
const ROW_GAP = 2 * space.xl

type Size = { width: number; height: number }
type Band = { top: number; bottom: number }

export function GuideTrail({ fill = false }: GuideTrailProps) {
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
    <View style={[styles.trail, fill && styles.fill]} onLayout={onLayout} accessibilityRole="list">
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
          <View key={step.number} style={[styles.step, right && styles.stepRight]} onLayout={(event) => placeRow(index, event)} accessible>
            <Disc>
              <TrailIcon size={iconSize.lg} weight="fill" color={colors.accentStrong} />
            </Disc>
            <View style={[styles.text, right && styles.textRight]}>
              <View style={[styles.title, right && styles.titleRight]}>
                <Text variant="eyebrow">{step.number}</Text>
                <Text variant="heading" align={align} style={styles.titleText}>
                  {step.title}
                </Text>
              </View>
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

/* The trail as an SVG path: a straight run under each disc's column from
   the row's top edge to its bottom edge, joined to the next row by a curve
   through the gap that carries it to the other bank, entering from the top
   edge above the first row and leaving through the bottom edge. Empty until
   every row has been measured. */
function trailPath({ width, height }: Size, bands: Band[]): string {
  if (width <= 0 || bands.some((band) => band.bottom <= band.top)) return ''
  const column = (index: number) => (index % 2 === 1 ? width - DISC / 2 : DISC / 2)
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
  /* Grows, never shrinks below the rows, so a large text size still scrolls
     the page instead of clipping the trail. */
  fill: {
    flexGrow: 1,
    justifyContent: 'space-evenly',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stepRight: {
    flexDirection: 'row-reverse',
  },
  text: {
    flex: 1,
    gap: space.xs,
  },
  textRight: {
    alignItems: 'flex-end',
  },
  /* As wide as the column, so a long title wraps inside it on either bank. */
  title: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  titleRight: {
    justifyContent: 'flex-end',
  },
  titleText: {
    flexShrink: 1,
  },
})
