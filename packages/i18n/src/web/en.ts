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
  footer: {
    docsAria: 'Documents',
    terms: 'Terms of Service',
    termsHref: 'legal/terms.html',
    privacy: 'Privacy Policy',
    privacyHref: 'legal/privacy.html',
    socialAria: 'Social media',
  },
  lore: {
    sectionAria: 'About Chatynkowo',
    eyebrow: 'About Chatynkowo',
    title: 'A place where fairy tales become real',
    intro1:
      'In hidden corners of nature, tiny cottages await you — the homes of real Elves. Each one keeps an extraordinary story and the wisdom of its resident, hidden inside a magical tale.',
    intro2:
      'Chatynkowo is a fairy-tale outdoor game in the Kraków-Częstochowa Jura: you seek out the hidden Cottages, collect seals and unlock the tales of the Elves — and every tale leaves a little Elvish wisdom in your Chronicle.',
    creedQuote: '“Leave the cottage just as you found it — the forest remembers.”',
    creedBody:
      'The Cottages live in a real forest, so we enter it as guests: quietly, mindfully and with a kind heart. It is to such wanderers that the Elves tell their stories.',
    openAtlas: 'Open the Atlas',
    howToStart: 'See how to begin',
    cardWhatTitle: 'What are the Cottages?',
    cardWhatBody: 'Tiny, mysterious woodland houses full of magic and stories.',
    cardWhoTitle: 'Who lives inside?',
    cardWhoBody: 'Elves. Each of them has a story to tell us. A very important one.',
    cardFindTitle: 'How to find them?',
    cardFindBody:
      'You may come across an Elf at any moment. If you want to seek them out, open the fairy-tale map and pick a trail.',
    cardArriveTitle: 'What to do at a Cottage?',
    cardArriveBody: 'Scan the QR code on the plaque nearby or enter the secret four-digit code.',
  },
  guide: {
    eyebrow: "Tracker's Notebook",
    title: 'If this is your first expedition',
    lead: "You don't need to read a manual cover to cover. Remember four moves — the Atlas and the trail itself will hint at the rest.",
    step1Title: 'Pick a marker',
    step1Body: 'Open a point in the Atlas and read its clue.',
    step2Title: 'Head into the field',
    step2Body: 'The Cottages wait in real places across the Jura.',
    step3Title: 'Find the code',
    step3Body: 'The four digits are on the plaque by the Cottage.',
    step4Title: 'Wake the story',
    step4Body: 'Save the tale and its seal in your Chronicle.',
    photoAlt: 'A forest trail leading to a glowing Cottage',
    quote: '“The Cottages show themselves only to those who look closely.”',
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
