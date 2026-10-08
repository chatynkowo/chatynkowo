import type { webPl } from './pl'

/* English copy of the site-only strings. Typed against the Polish set so a
   key added on one side cannot be forgotten on the other. */
export const webEn: typeof webPl = {
  meta: {
    homeTitle: 'Chatynkowo | A fairy-tale outdoor game in the Kraków-Częstochowa Jura',
    homeDescription:
      'A fairy-tale outdoor game in the Kraków-Częstochowa Jura. Seek out the hidden Cottages — homes of real Elves — collect seals and unlock their tales.',
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
