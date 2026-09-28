/* The icon vocabulary of the app — the same semantic names and size scale
   as apps/web/src/ui/icons.ts, so a design decision is made once. The role
   names are the shared lists in @chatynkowo/theme; the `satisfies` checks
   at the end fail the build when a role is missing on this side.

   Rules:
   - phosphor-react-native is the only icon library, and this file is the
     only module allowed to import it; scripts/check-conventions.mjs fails
     the build on any other import. Screens use the semantic names below.
   - Never use emoji or typographic symbols (arrows, crosses, ticks) as
     icons, in markup or in comments — the same script rejects them.
   - Sizes come from `iconSize`, not from ad-hoc numbers.

   When a shared role is added, add it to SHARED_ICON_ROLES in the theme and
   to both vocabularies; app-only roles go to MOBILE_ICON_ROLES. */
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenTextIcon,
  CameraIcon as PhosphorCamera,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon as PhosphorCheck,
  CircleNotchIcon,
  CloudArrowUpIcon,
  CrownIcon,
  DownloadSimpleIcon,
  FacebookLogoIcon,
  FootprintsIcon,
  GpsFixIcon,
  HandHeartIcon,
  HouseLineIcon,
  InstagramLogoIcon,
  KeyIcon as PhosphorKey,
  LockKeyOpenIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MapTrifoldIcon,
  MinusIcon,
  MoonStarsIcon,
  NavigationArrowIcon,
  PauseIcon as PhosphorPause,
  PlayIcon as PhosphorPlay,
  PlusIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SignOutIcon as PhosphorSignOut,
  SparkleIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  TranslateIcon,
  TreeEvergreenIcon,
  TrophyIcon,
  UserCircleIcon,
  WarningIcon as PhosphorWarning,
  WifiSlashIcon,
  XIcon,
} from 'phosphor-react-native'

import type { Icon } from 'phosphor-react-native'
import { iconSize, type MobileIconRole, type SharedIconRole } from '@chatynkowo/theme'

export type { Icon, IconProps, IconWeight } from 'phosphor-react-native'
export { iconSize, type IconSize } from '@chatynkowo/theme'

/* ---------- Interface roles ---------- */
export const CloseIcon = XIcon
export const BackIcon = ArrowLeftIcon
export const ForwardIcon = ArrowRightIcon
export const PreviousIcon = CaretLeftIcon
export const NextIcon = CaretRightIcon
export const ExpandIcon = CaretDownIcon
export const CheckIcon = PhosphorCheck
export const PlayIcon = PhosphorPlay
export const PauseIcon = PhosphorPause
export const SoundOnIcon = SpeakerHighIcon
export const SoundOffIcon = SpeakerSlashIcon
export const ZoomInIcon = PlusIcon
export const ZoomOutIcon = MinusIcon
export const ResetViewIcon = ArrowCounterClockwiseIcon
export const LocateIcon = GpsFixIcon
export const SpinnerIcon = CircleNotchIcon
export const SearchIcon = MagnifyingGlassIcon

/* ---------- Domain: the expedition ---------- */
export const CottageIcon = HouseLineIcon
export const FoundIcon = CheckCircleIcon
export const PinIcon = MapPinIcon
export const NavigateIcon = NavigationArrowIcon
export const AtlasIcon = MapTrifoldIcon
export const TrailIcon = FootprintsIcon
export const KeyIcon = PhosphorKey
export const SealIcon = LockKeyOpenIcon
export const QrIcon = QrCodeIcon
export const ShieldIcon = ShieldCheckIcon

/* ---------- Domain: the Kronika and the lore ---------- */
export const ChronicleIcon = CrownIcon
export const RewardIcon = TrophyIcon
export const NotebookIcon = BookOpenTextIcon
export const StoryAudioIcon = SpeakerHighIcon
export const LoreIcon = MoonStarsIcon
export const CreedIcon = HandHeartIcon
export const ElfIcon = SparkleIcon
export const ForestIcon = TreeEvergreenIcon

/* ---------- Brands ---------- */
export const InstagramIcon = InstagramLogoIcon
export const FacebookIcon = FacebookLogoIcon

/* ---------- App-only roles (native surfaces the site does not have) ---------- */
export const CameraIcon = PhosphorCamera
export const ProfileIcon = UserCircleIcon
export const SignOutIcon = PhosphorSignOut
export const OfflineIcon = WifiSlashIcon
export const SyncIcon = CloudArrowUpIcon
export const DownloadIcon = DownloadSimpleIcon
export const WarningIcon = PhosphorWarning
export const LanguageIcon = TranslateIcon

/* The vocabulary as one object, checked against the shared and app-only
   roles: a missing role is a compile error. */
export const ICON_VOCABULARY = {
  CloseIcon, BackIcon, ForwardIcon, PreviousIcon, NextIcon, ExpandIcon, CheckIcon, PlayIcon, PauseIcon,
  SoundOnIcon, SoundOffIcon, ZoomInIcon, ZoomOutIcon, ResetViewIcon, LocateIcon, SpinnerIcon, SearchIcon,
  CottageIcon, FoundIcon, PinIcon, NavigateIcon, AtlasIcon, TrailIcon, KeyIcon, SealIcon, QrIcon, ShieldIcon,
  ChronicleIcon, RewardIcon, NotebookIcon, StoryAudioIcon, LoreIcon, CreedIcon, ElfIcon, ForestIcon,
  InstagramIcon, FacebookIcon,
  CameraIcon, ProfileIcon, SignOutIcon, OfflineIcon, SyncIcon, DownloadIcon, WarningIcon, LanguageIcon,
} satisfies Record<SharedIconRole | MobileIconRole, Icon>
