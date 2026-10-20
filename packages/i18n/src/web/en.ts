import type { webPl } from './pl'

/* English copy of the site-only strings. Typed against the Polish set so a
   key added on one side cannot be forgotten on the other. */
export const webEn: typeof webPl = {
  meta: {
    homeTitle: 'Chatynkowo | A fairy-tale outdoor game in the Kraków-Częstochowa Jura',
    homeDescription:
      'A fairy-tale outdoor game in the Kraków-Częstochowa Jura. Seek out the hidden Cottages — homes of real Elves — collect seals and unlock their tales. The app is out on Google Play.',
    rankingTitle: "Explorers' Leaderboard | Chatynkowo",
    rankingDescription:
      "The Chatynkowo Explorers' Leaderboard: see who has discovered the most fairy-tale Cottages and who completed the set fastest.",
    profileTitle: 'Explorer Profile | Chatynkowo',
    profileDescription:
      "Your Chatynkowo account: sign in to save your discoveries, get the Chronicle back on every device and take your place in the Explorers' Leaderboard.",
    deleteAccountTitle: 'Delete account | Chatynkowo',
    deleteAccountDescription:
      'Delete your Chatynkowo account together with the profile, the nickname, the photo and the discoveries saved to it. This cannot be undone.',
  },
  common: {
    skipToContent: 'Skip to content',
  },
  app: {
    ribbonAria: 'The Chatynkowo app is available',
    ribbonTitle: 'The Chatynkowo app',
    ribbonText: 'Now on Google Play',
    ribbonMore: 'What does it do?',
    ribbonDownload: 'Get it',
    sectionAria: 'The Chatynkowo app',
    eyebrow: 'New',
    title: 'Chatynkowo now fits in your pocket',
    lead:
      'The Chatynkowo app is out on Google Play. Take it on the trail: it scans the codes on the plaques, points you to the nearest Cottage and works even where there is no signal.',
    download: 'Get it on Google Play',
    downloadAria: 'Get the Chatynkowo app on Google Play (opens in a new tab)',
    appStoreSoon: 'App Store soon',
    perk1Title: 'Compete with others',
    perk1Body: 'The Explorers’ Leaderboard is at hand: see who has found the most Cottages and take your place in it.',
    perk2Title: 'A map without signal',
    perk2Body: 'After the first launch the Cottages stay on your phone. Codes are checked offline too.',
    perk3Title: 'A trail to the nearest Cottage',
    perk3Body: 'The expedition compass shows which way and how far to the nearest Elf.',
    perk4Title: 'One Chronicle everywhere',
    perk4Body: 'Sign in with the same account and your finds from the site and the app meet in one Chronicle.',
  },
  profilePage: {
    eyebrow: 'Explorer profile',
    title: 'Your account',
    lede: "An account gathers the discoveries from every device and browser of yours, hands the Chronicle back on each of them and leads to your place in the Explorers' Leaderboard.",
    loadFailed: 'Your profile could not be loaded. Refresh the page and try again.',
    entryTitle: 'Your leaderboard entry',
    publicNote: 'Other trackers will see these details.',
    save: 'Save changes',
  },
  deleteAccountPage: {
    eyebrow: 'Explorer account',
    title: 'Delete account',
    lede: 'You can delete your Chatynkowo account at any time: here, once signed in, or in the app on the Account screen. Deletion is immediate and cannot be undone.',
    removesTitle: 'What is deleted',
    removesAccount: 'the account, that is the link to your Google or Apple sign-in,',
    removesProfile: "the profile: the nickname and the photo, and with them your entry in the Explorers' Leaderboard,",
    removesFinds: 'the discoveries saved to the account.',
    keepsTitle: 'What stays',
    keepsBody:
      'The Chronicle kept in the browser and in the app on your devices, because it is stored locally, not on a server. You can clear it by removing the site data in your browser or by uninstalling the app. We keep no other data about you (see the privacy policy).',
    howTitle: 'How to delete the account',
    howApp: 'In the app: Profile, Account, Delete account, confirm.',
    howWeb: 'On this page: sign in with the account you want to delete, press "Delete account" and confirm.',
    signInLead: 'Sign in with the account you want to delete.',
    contact:
      'If you cannot sign in, write to us on Instagram or Facebook (links in the footer) with the e-mail address of the account; we will delete it by hand.',
    doneTitle: 'The account has been deleted',
    doneBody: 'Thank you for the expedition together. The discoveries saved in this browser stayed where they were.',
    backToGame: 'Back to the game',
  },
  gallery: {
    listAria: 'Gallery of Cottage photos',
    openPhoto: 'Enlarge photo {{index}} of {{count}}',
    lightboxAria: 'Photo {{index}} of {{count}}',
    closeAria: 'Close the preview',
    photoAlt: 'A fairy-tale Elf cottage hidden in the forest',
    previous: 'Previous photo',
    next: 'Next photo',
  },
}
