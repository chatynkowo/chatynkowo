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
  },
  common: {
    skipToContent: 'Skip to content',
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
