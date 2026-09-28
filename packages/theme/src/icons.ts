/* The icon vocabulary's roles: the semantic names both clients export from
   their icons.ts, so a design decision (which glyph plays which role) is
   made once and a role missing on one side fails compilation. The glyphs
   themselves come from @phosphor-icons/react on the site and
   phosphor-react-native in the app. */

export const SHARED_ICON_ROLES = [
  /* Interface */
  'CloseIcon',
  'BackIcon',
  'ForwardIcon',
  'PreviousIcon',
  'NextIcon',
  'ExpandIcon',
  'CheckIcon',
  'PlayIcon',
  'PauseIcon',
  'SoundOnIcon',
  'SoundOffIcon',
  'ZoomInIcon',
  'ZoomOutIcon',
  'ResetViewIcon',
  'LocateIcon',
  'SpinnerIcon',
  'SearchIcon',
  /* The expedition */
  'CottageIcon',
  'FoundIcon',
  'PinIcon',
  'NavigateIcon',
  'AtlasIcon',
  'TrailIcon',
  'KeyIcon',
  'SealIcon',
  'QrIcon',
  'ShieldIcon',
  /* The Kronika and the lore */
  'ChronicleIcon',
  'RewardIcon',
  'NotebookIcon',
  'StoryAudioIcon',
  'LoreIcon',
  'CreedIcon',
  'ElfIcon',
  'ForestIcon',
  /* Brands */
  'InstagramIcon',
  'FacebookIcon',
] as const

/* Roles only the app has a surface for. */
export const MOBILE_ICON_ROLES = [
  'CameraIcon',
  'ProfileIcon',
  'SignOutIcon',
  'OfflineIcon',
  'SyncIcon',
  'DownloadIcon',
  'WarningIcon',
  'LanguageIcon',
] as const

export type SharedIconRole = (typeof SHARED_ICON_ROLES)[number]
export type MobileIconRole = (typeof MOBILE_ICON_ROLES)[number]

/* Type-checks a vocabulary against its role list without changing it:
   `const vocabulary = defineIcons<Icon, SharedIconRole>()({ ... })`. */
export function defineIcons<Glyph, Role extends string>() {
  return <T extends Record<Role, Glyph>>(vocabulary: T & Record<Exclude<keyof T, Role>, never>) => vocabulary
}
