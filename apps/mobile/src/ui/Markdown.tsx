import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Linking, StyleSheet, Text as NativeText, View } from 'react-native'
import { Lexer, type Token, type Tokens } from 'marked'
import { Text } from './Text'
import { colors, fonts, mapPalette, radius, space, typeScale } from './tokens'

/* Renders the authored markdown (stories, reward cards, the Kronika intro)
   as native views. The tokens come from marked, the very parser the site
   uses, with the same `breaks: true` (apps/web/src/lib/markdown.ts): the
   admin editor shows a single newline as a line break, so both surfaces
   must too. Only the constructs the editor produces are styled; anything
   else falls back to its plain text. */

/* A Lexer instance accumulates tokens across calls, so each text gets its
   own; the options mirror the site's marked configuration. */
const LEXER_OPTIONS = { breaks: true, gfm: true }

/* The editor's WYSIWYG leaves a few HTML tags in the text (a <br> between
   paragraphs, mostly); native text has no HTML, so tags become line breaks
   or vanish. */
function htmlToText(html: string) {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
}

/* Entities the lexer leaves as written. */
const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

function decode(text: string) {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
}

/* `parchment` is for the light cottage panel on the map, where the site
   sets dark brown copy instead of cream. */
export type MarkdownTone = 'ink' | 'parchment'

type MarkdownViewProps = { children: string; tone?: MarkdownTone }

export function MarkdownView({ children, tone = 'ink' }: MarkdownViewProps) {
  const tokens = useMemo(() => Lexer.lex(children, LEXER_OPTIONS), [children])
  return (
    <ToneContext.Provider value={tone}>
      <View style={styles.root}>
        {tokens.map((token, index) => (
          <Block key={index} token={token} />
        ))}
      </View>
    </ToneContext.Provider>
  )
}

const ToneContext = createContext<MarkdownTone>('ink')

function useInk() {
  const tone = useContext(ToneContext)
  return tone === 'parchment' ? parchment : null
}

function Block({ token }: { token: Token }): ReactNode {
  const ink = useInk()
  switch (token.type) {
    case 'space':
      return null
    case 'heading': {
      const { tokens } = token as Tokens.Heading
      return (
        <Text variant="heading" style={[styles.heading, ink?.text]} accessibilityRole="header">
          <Inline tokens={tokens} />
        </Text>
      )
    }
    case 'paragraph':
      return (
        <Text style={[styles.paragraph, ink?.text]}>
          <Inline tokens={(token as Tokens.Paragraph).tokens} />
        </Text>
      )
    case 'text': {
      const { tokens, text } = token as Tokens.Text
      return <Text style={[styles.paragraph, ink?.text]}>{tokens ? <Inline tokens={tokens} /> : decode(text)}</Text>
    }
    case 'blockquote':
      return (
        <View style={styles.blockquote}>
          {(token as Tokens.Blockquote).tokens.map((child, index) => (
            <Block key={index} token={child} />
          ))}
        </View>
      )
    case 'list': {
      const { ordered, start, items } = token as Tokens.List
      const first = typeof start === 'number' ? start : 1
      return (
        <View style={styles.list} accessibilityRole="list">
          {items.map((item, index) => (
            <View key={index} style={styles.listItem}>
              {ordered ? (
                <Text tone="accent" weight="bold" style={[styles.bullet, ink?.marker]}>
                  {`${first + index}.`}
                </Text>
              ) : (
                <View style={styles.bullet}>
                  <View style={[styles.dot, ink?.dot]} />
                </View>
              )}
              <View style={styles.listBody}>
                {item.tokens.map((child, childIndex) => (
                  <Block key={childIndex} token={child} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )
    }
    case 'hr':
      return <View style={styles.hr} />
    case 'code':
      return (
        <View style={styles.code}>
          <Text variant="small">{(token as Tokens.Code).text}</Text>
        </View>
      )
    case 'html': {
      const text = htmlToText((token as Tokens.HTML).text).trim()
      return text ? <Text style={[styles.paragraph, ink?.text]}>{text}</Text> : null
    }
    default:
      return <Text style={[styles.paragraph, ink?.text]}>{decode(token.raw)}</Text>
  }
}

function Inline({ tokens }: { tokens: Token[] | undefined }): ReactNode {
  if (!tokens) return null
  return tokens.map((token, index) => <InlineToken key={index} token={token} />)
}

function InlineToken({ token }: { token: Token }): ReactNode {
  switch (token.type) {
    case 'text':
    case 'escape':
      return decode((token as Tokens.Text).text)
    case 'strong':
      return (
        <NativeText style={styles.strong}>
          <Inline tokens={(token as Tokens.Strong).tokens} />
        </NativeText>
      )
    case 'em':
      return (
        <NativeText style={styles.em}>
          <Inline tokens={(token as Tokens.Em).tokens} />
        </NativeText>
      )
    case 'del':
      return (
        <NativeText style={styles.del}>
          <Inline tokens={(token as Tokens.Del).tokens} />
        </NativeText>
      )
    case 'link': {
      const { href, tokens } = token as Tokens.Link
      return (
        <NativeText style={styles.link} accessibilityRole="link" onPress={() => void Linking.openURL(href)}>
          <Inline tokens={tokens} />
        </NativeText>
      )
    }
    case 'codespan':
      return <NativeText style={styles.codespan}>{decode((token as Tokens.Codespan).text)}</NativeText>
    case 'br':
      return '\n'
    case 'image':
      return decode((token as Tokens.Image).text)
    case 'html':
      return htmlToText((token as Tokens.HTML).text)
    default:
      return decode(token.raw)
  }
}

const styles = StyleSheet.create({
  root: {
    gap: space.sm,
  },
  heading: {
    marginTop: space.sm,
  },
  paragraph: {
    ...typeScale.body,
  },
  strong: {
    fontFamily: fonts.semibold,
  },
  em: {
    fontFamily: fonts.bodyItalic,
  },
  del: {
    textDecorationLine: 'line-through',
  },
  link: {
    color: colors.accentStrong,
    textDecorationLine: 'underline',
  },
  codespan: {
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  blockquote: {
    gap: space.sm,
    backgroundColor: colors.surfaceSoft,
    borderLeftColor: colors.accent,
    borderLeftWidth: 3,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  list: {
    gap: space.xs,
  },
  listItem: {
    flexDirection: 'row',
    gap: space.sm,
  },
  bullet: {
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: typeScale.body.lineHeight,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentStrong,
  },
  listBody: {
    flex: 1,
    gap: space.xs,
  },
  hr: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: space.sm,
  },
  code: {
    padding: space.md,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
})

const parchment = StyleSheet.create({
  text: { color: mapPalette.panelText },
  marker: { color: mapPalette.panelMuted },
  dot: { backgroundColor: mapPalette.panelMuted },
})
