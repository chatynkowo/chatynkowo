import type { mobilePl } from './pl'

/* English copy of the mobile-only strings. Typed against the Polish set so a
   key added on one side cannot be forgotten on the other. */
export const mobileEn: typeof mobilePl = {
  tabs: {
    atlas: 'Atlas',
    code: 'Code',
    kronika: 'Chronicle',
    ranking: 'Leaderboard',
  },
  common: {
    retry: 'Try again',
    close: 'Close',
    loading: 'Loading...',
    offline: 'No connection. Showing the saved version.',
    offlineNoData: 'No connection, and this device has no saved map yet. Connect once to download the Cottages.',
    pendingSync_one: '{{count}} discovery is waiting to be saved to your account.',
    pendingSync_few: '{{count}} discoveries are waiting to be saved to your account.',
    pendingSync_many: '{{count}} discoveries are waiting to be saved to your account.',
    pendingSync_other: '{{count}} discoveries are waiting to be saved to your account.',
    language: 'Language',
  },
  atlas: {
    title: 'Chatynkowo Atlas',
    progress: '{{found}} of {{total}} Cottages',
    story: 'Open the tale',
  },
  code: {
    scan: 'Scan the QR code',
    scanTitle: 'Scanning',
    scanHint: 'Point the camera at the QR code on the plaque.',
    scanNoCode: 'This QR code does not belong to Chatynkowo.',
    cameraRequest: 'The camera is needed to read the QR code on the plaque.',
    cameraAllow: 'Allow the camera',
    cameraDenied: 'Without camera access, type the code by hand.',
    offlineHint: 'Codes are checked without signal too. The discovery reaches your account once you are back online.',
    pasteAria: 'Enter the code',
  },
  story: {
    download: 'Save the recording on this device',
    downloading: 'Downloading the recording...',
    downloaded: 'Recording saved on this device',
    downloadFailed: 'The recording could not be downloaded.',
    playerUnavailable: 'The player is unavailable.',
    arrivalHeading: 'What to do at the Cottage?',
    notFound: 'This tale was not found.',
  },
  kronika: {
    subtitle: 'Seals and badges from your expedition',
    earnedOn: 'Earned {{date}}',
  },
  ranking: {
    signInTitle: 'Join the leaderboard',
    signInLead: 'Sign in to save your discoveries to an account and see your place.',
    signInGoogle: 'Sign in with Google',
    signInApple: 'Sign in with Apple',
    signInUnavailable: 'Signing in from the app is coming soon. Your discoveries are safe on this device.',
    signInFailed: 'Sign-in failed. Please try again.',
    profile: 'Profile',
    yourPlace: 'Your place: {{place}}',
    notRanked: 'Save your first discovery to an account to appear on the leaderboard.',
  },
  profile: {
    title: 'Explorer profile',
    signedOut: 'You are not signed in.',
    saved: 'Saved.',
    finds: 'Discoveries in your account: {{count}}',
  },
}
