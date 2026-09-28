/* The icon vocabulary of the app — the same semantic names and size scale
   as apps/web/src/ui/icons.ts, so a design decision is made once.

   Rules:
   - phosphor-react-native is the only icon library, and this file is the
     only module allowed to import it; scripts/check-conventions.mjs fails
     the build on any other import. Screens use the semantic names below.
   - Never use emoji or typographic symbols (arrows, crosses, ticks) as
     icons, in markup or in comments — the same script rejects them.
   - Sizes come from `iconSize`, not from ad-hoc numbers.

   When a role is added here, add it to the web vocabulary too (and the
   other way round), keeping the two files in step. */
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

export type { Icon, IconProps, IconWeight } from 'phosphor-react-native'

/* One scale for every icon in the app, identical to the site's. Pick by
   role, not by taste: xs/sm inline with small text, md inside controls and
   next to body copy, lg for standalone controls, xl for section markers,
   hero and emblem for decorative headers. */
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
