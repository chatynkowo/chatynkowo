/* The icon vocabulary of the app — the same semantic names and size scale
   as apps/web/src/ui/icons.ts, so a design decision is made once. The role
   names are the shared lists in @chatynkowo/theme; the `satisfies` checks
   at the end fail the build when a role is missing on this side.

   Rules:
   - phosphor-react-native is the only icon library, and this file is the
     only module allowed to import it; scripts/check-conventions.mjs fails
     the build on any other import. Screens use the semantic names below.
   - Each icon comes from its own entry (`src/icons/<Name>`), never from the
     package root: Metro does not tree-shake, and the root carries all 1500
     icons, several megabytes in the bundle for the fifty in use. The same
     script rejects a value import from the root.
   - Never use emoji or typographic symbols (arrows, crosses, ticks) as
     icons, in markup or in comments — the same script rejects them.
   - Sizes come from `iconSize`, not from ad-hoc numbers.

   When a shared role is added, add it to SHARED_ICON_ROLES in the theme and
   to both vocabularies; app-only roles go to MOBILE_ICON_ROLES. */
import { ArrowCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowCounterClockwise'
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft'
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight'
import { ArrowUpIcon } from 'phosphor-react-native/src/icons/ArrowUp'
import { BookOpenTextIcon } from 'phosphor-react-native/src/icons/BookOpenText'
import { CameraIcon as PhosphorCamera } from 'phosphor-react-native/src/icons/Camera'
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown'
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft'
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight'
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle'
import { CheckIcon as PhosphorCheck } from 'phosphor-react-native/src/icons/Check'
import { CircleNotchIcon } from 'phosphor-react-native/src/icons/CircleNotch'
import { CloudArrowUpIcon } from 'phosphor-react-native/src/icons/CloudArrowUp'
import { CrownIcon } from 'phosphor-react-native/src/icons/Crown'
import { DownloadSimpleIcon } from 'phosphor-react-native/src/icons/DownloadSimple'
import { FacebookLogoIcon } from 'phosphor-react-native/src/icons/FacebookLogo'
import { FlashlightIcon } from 'phosphor-react-native/src/icons/Flashlight'
import { FootprintsIcon } from 'phosphor-react-native/src/icons/Footprints'
import { GpsFixIcon } from 'phosphor-react-native/src/icons/GpsFix'
import { HandHeartIcon } from 'phosphor-react-native/src/icons/HandHeart'
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine'
import { InfoIcon as PhosphorInfo } from 'phosphor-react-native/src/icons/Info'
import { InstagramLogoIcon } from 'phosphor-react-native/src/icons/InstagramLogo'
import { KeyIcon as PhosphorKey } from 'phosphor-react-native/src/icons/Key'
import { LightningSlashIcon } from 'phosphor-react-native/src/icons/LightningSlash'
import { LockKeyOpenIcon } from 'phosphor-react-native/src/icons/LockKeyOpen'
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass'
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin'
import { MapTrifoldIcon } from 'phosphor-react-native/src/icons/MapTrifold'
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus'
import { MoonStarsIcon } from 'phosphor-react-native/src/icons/MoonStars'
import { NavigationArrowIcon } from 'phosphor-react-native/src/icons/NavigationArrow'
import { PauseIcon as PhosphorPause } from 'phosphor-react-native/src/icons/Pause'
import { PlayIcon as PhosphorPlay } from 'phosphor-react-native/src/icons/Play'
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus'
import { QrCodeIcon } from 'phosphor-react-native/src/icons/QrCode'
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork'
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck'
import { SignOutIcon as PhosphorSignOut } from 'phosphor-react-native/src/icons/SignOut'
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle'
import { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh'
import { SpeakerSlashIcon } from 'phosphor-react-native/src/icons/SpeakerSlash'
import { TranslateIcon } from 'phosphor-react-native/src/icons/Translate'
import { TreeEvergreenIcon } from 'phosphor-react-native/src/icons/TreeEvergreen'
import { TrophyIcon } from 'phosphor-react-native/src/icons/Trophy'
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle'
import { WarningIcon as PhosphorWarning } from 'phosphor-react-native/src/icons/Warning'
import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash'
import { XIcon } from 'phosphor-react-native/src/icons/X'

import type { Icon } from 'phosphor-react-native'
import type { NativeStackHeaderItemButton } from 'expo-router'
import type { MobileIconRole, SharedIconRole } from '@chatynkowo/theme'

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
/* Turned to the heading of the nearest cottage on the Atlas. */
export const BearingIcon = ArrowUpIcon
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

/* ---------- Domain: the account ---------- */
export const ProfileIcon = UserCircleIcon
export const SignOutIcon = PhosphorSignOut

/* ---------- Brands ---------- */
export const InstagramIcon = InstagramLogoIcon
export const FacebookIcon = FacebookLogoIcon

/* ---------- App-only roles (native surfaces the site does not have) ---------- */
export const CameraIcon = PhosphorCamera
export const OfflineIcon = WifiSlashIcon
export const SyncIcon = CloudArrowUpIcon
export const DownloadIcon = DownloadSimpleIcon
export const WarningIcon = PhosphorWarning
export const LanguageIcon = TranslateIcon
export const ShareIcon = ShareNetworkIcon
export const TorchIcon = FlashlightIcon
/* Phosphor has no slashed flashlight; the slashed lightning is the closest
   "flash off" glyph, the one camera apps use. */
export const TorchOffIcon = LightningSlashIcon
export const InfoIcon = PhosphorInfo

/* The vocabulary as one object, checked against the shared and app-only
   roles: a missing role is a compile error. */
export const ICON_VOCABULARY = {
  CloseIcon, BackIcon, ForwardIcon, PreviousIcon, NextIcon, ExpandIcon, CheckIcon, PlayIcon, PauseIcon,
  SoundOnIcon, SoundOffIcon, ZoomInIcon, ZoomOutIcon, ResetViewIcon, LocateIcon, SpinnerIcon, SearchIcon,
  CottageIcon, FoundIcon, PinIcon, NavigateIcon, BearingIcon, AtlasIcon, TrailIcon, KeyIcon, SealIcon, QrIcon, ShieldIcon,
  ChronicleIcon, RewardIcon, NotebookIcon, StoryAudioIcon, LoreIcon, CreedIcon, ElfIcon, ForestIcon,
  InstagramIcon, FacebookIcon,
  CameraIcon, ProfileIcon, SignOutIcon, OfflineIcon, SyncIcon, DownloadIcon, WarningIcon, LanguageIcon,
  ShareIcon, TorchIcon, TorchOffIcon, InfoIcon,
} satisfies Record<SharedIconRole | MobileIconRole, Icon>

/* ---------- The tab bar and the native headers ---------- */

/* SF Symbol names, as the native stack types them (sf-symbols-typescript is
   a dependency of expo-router, not of the app, so the type is read through
   the header item contract rather than imported). */
export type SFSymbol = Extract<NonNullable<NativeStackHeaderItemButton['icon']>, { type: 'sfSymbol' }>['name']

export type TabIcon = {
  /* The Phosphor glyph the tab bar draws: outline idle, filled when selected. */
  Glyph: Icon
}

/* The four tabs' glyphs, keyed by route name (see app/(tabs)/_layout.tsx). */
export const TAB_ICONS = {
  index: { Glyph: AtlasIcon },
  kronika: { Glyph: ChronicleIcon },
  ranking: { Glyph: RewardIcon },
  profile: { Glyph: ProfileIcon },
} as const satisfies Record<string, TabIcon>

export type HeaderSymbol = {
  /* iOS: the SF Symbol the native bar draws. */
  sf: SFSymbol
  /* Android: the Phosphor glyph rendered inside an IconButton. */
  Glyph: Icon
}

/* The header button roles of the native stack (see headerItems.tsx). */
export const HEADER_SYMBOLS = {
  close: { sf: 'xmark', Glyph: CloseIcon },
  share: { sf: 'square.and.arrow.up', Glyph: ShareIcon },
  info: { sf: 'info.circle', Glyph: InfoIcon },
  torchOn: { sf: 'flashlight.on.fill', Glyph: TorchIcon },
  torchOff: { sf: 'flashlight.off.fill', Glyph: TorchOffIcon },
} as const satisfies Record<string, HeaderSymbol>
