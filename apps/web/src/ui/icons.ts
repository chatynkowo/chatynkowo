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

   The role names are the shared list in @chatynkowo/theme (SHARED_ICON_ROLES);
   the app's vocabulary exports the same names on phosphor-react-native, and
   the `satisfies` check below fails the build when a role is missing. */
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

import type { Icon } from '@phosphor-icons/react'
import { iconSize, type SharedIconRole } from '@chatynkowo/theme'

export type { Icon, IconProps, IconWeight } from '@phosphor-icons/react'
export { iconSize, type IconSize } from '@chatynkowo/theme'

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

/* The vocabulary as one object, checked against the shared roles: a
   missing role is a compile error. */
export const ICON_VOCABULARY = {
  CloseIcon, BackIcon, ForwardIcon, PreviousIcon, NextIcon, ExpandIcon, CheckIcon, PlayIcon, PauseIcon,
  SoundOnIcon, SoundOffIcon, ZoomInIcon, ZoomOutIcon, ResetViewIcon, LocateIcon, SpinnerIcon, SearchIcon,
  CottageIcon, FoundIcon, PinIcon, NavigateIcon, AtlasIcon, TrailIcon, KeyIcon, SealIcon, QrIcon, ShieldIcon,
  ChronicleIcon, RewardIcon, NotebookIcon, StoryAudioIcon, LoreIcon, CreedIcon, ElfIcon, ForestIcon,
  InstagramIcon, FacebookIcon,
} satisfies Record<SharedIconRole, Icon>
