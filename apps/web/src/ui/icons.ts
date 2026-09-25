/* The icon vocabulary of the site.

   Rules:
   - Phosphor (@phosphor-icons/react) is the only icon library, and this file
     is the only module allowed to import it. Everything else imports the
     semantic names below, so swapping the library or a glyph is a one-line
     change here and never a search across the code base.
   - Never use emoji or typographic symbols (arrows, crosses, ticks) as
     icons, in markup or in CSS `content`. scripts/check-conventions.mjs
     fails the build when one slips in.
   - Sizes come from `iconSize`, not from ad-hoc numbers.
   - Static HTML (legal pages) and the vanilla admin editor use the same
     glyphs through the SVG sprite generated from @phosphor-icons/core; the
     list of sprite icons lives in sprite-icons.json next to this file.

   The mobile app should mirror this vocabulary with phosphor-react-native,
   keeping the semantic names identical. */
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  Crown,
  FacebookLogo,
  Footprints,
  GpsFix,
  HandHeart,
  HouseLine,
  InstagramLogo,
  Key,
  LockKeyOpen,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Minus,
  MoonStars,
  NavigationArrow,
  Pause,
  Play,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  TreeEvergreen,
  Trophy,
  X,
} from '@phosphor-icons/react'

export type { Icon, IconProps, IconWeight } from '@phosphor-icons/react'

/* One scale for every icon on the site. Pick by role, not by taste:
   xs/sm inline with small text, md inside controls and next to body copy,
   lg for standalone controls, xl for section markers, hero and emblem for
   decorative headers. */
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  hero: 34,
  emblem: 42,
} as const

export type IconSize = keyof typeof iconSize

/* ---------- Interface roles ---------- */
export const CloseIcon = X
export const BackIcon = ArrowLeft
export const ForwardIcon = ArrowRight
export const PreviousIcon = CaretLeft
export const NextIcon = CaretRight
export const ExpandIcon = CaretDown
export const CheckIcon = Check
export const PlayIcon = Play
export const PauseIcon = Pause
export const SoundOnIcon = SpeakerHigh
export const SoundOffIcon = SpeakerSlash
export const ZoomInIcon = Plus
export const ZoomOutIcon = Minus
export const ResetViewIcon = ArrowCounterClockwise
export const LocateIcon = GpsFix
export const SpinnerIcon = CircleNotch
export const SearchIcon = MagnifyingGlass

/* ---------- Domain: the expedition ---------- */
export const CottageIcon = HouseLine
export const FoundIcon = CheckCircle
export const PinIcon = MapPin
export const NavigateIcon = NavigationArrow
export const AtlasIcon = MapTrifold
export const TrailIcon = Footprints
export const KeyIcon = Key
export const SealIcon = LockKeyOpen
export const QrIcon = QrCode
export const ShieldIcon = ShieldCheck

/* ---------- Domain: the Kronika and the lore ---------- */
export const ChronicleIcon = Crown
export const RewardIcon = Trophy
export const NotebookIcon = BookOpenText
export const StoryAudioIcon = SpeakerHigh
export const LoreIcon = MoonStars
export const CreedIcon = HandHeart
export const ElfIcon = Sparkle
export const ForestIcon = TreeEvergreen

/* ---------- Brands ---------- */
export const InstagramIcon = InstagramLogo
export const FacebookIcon = FacebookLogo
