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
