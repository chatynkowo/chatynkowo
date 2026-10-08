/* Polish copy that exists only on the site: page meta, the skip link, the
   profile page's own words (the account block itself is shared), the
   photo gallery. Merged with the shared set into the site's "translation"
   namespace. */
export const webPl = {
  meta: {
    homeTitle: 'Chatynkowo | Baśniowa gra terenowa w Jurze Krakowsko-Częstochowskiej',
    homeDescription:
      'Baśniowa gra terenowa w Jurze Krakowsko-Częstochowskiej. Odszukuj ukryte Chatynki — domy prawdziwych Elfów — zdobywaj pieczęcie i otwieraj ich opowieści.',
    rankingTitle: 'Ranking Zdobywców | Chatynkowo',
    rankingDescription:
      'Ranking Zdobywców Chatynkowa: zobacz, kto odkrył najwięcej baśniowych Chatynek i kto zebrał komplet najszybciej.',
    profileTitle: 'Profil Zdobywcy | Chatynkowo',
    profileDescription:
      'Twoje konto w Chatynkowie: zaloguj się, aby zapisać odkrycia, odzyskać Kronikę na każdym urządzeniu i zająć miejsce w Rankingu Zdobywców.',
    deleteAccountTitle: 'Usuń konto | Chatynkowo',
    deleteAccountDescription:
      'Usuń swoje konto w Chatynkowie wraz z profilem, pseudonimem, zdjęciem i odkryciami zapisanymi w koncie. Operacja jest nieodwracalna.',
  },
  common: {
    skipToContent: 'Przejdź do treści',
  },
  profilePage: {
    eyebrow: 'Profil zdobywcy',
    title: 'Twoje konto',
    lede: 'Konto zbiera odkrycia z każdego Twojego urządzenia i przeglądarki, oddaje Kronikę na każdym z nich i prowadzi do Twojego miejsca w Rankingu Zdobywców.',
    loadFailed: 'Nie udało się wczytać profilu. Odśwież stronę i spróbuj ponownie.',
    entryTitle: 'Twój wpis w rankingu',
    publicNote: 'Te dane zobaczą pozostali tropiciele.',
    save: 'Zapisz zmiany',
  },
  /* The account deletion page (delete-account.html), the address the app
     stores point to: what the account holds, what deleting it removes,
     what stays, and the deletion itself for a signed-in seeker. */
  deleteAccountPage: {
    eyebrow: 'Konto zdobywcy',
    title: 'Usuń konto',
    lede: 'Możesz usunąć swoje konto w Chatynkowie w każdej chwili: tutaj, po zalogowaniu, albo w aplikacji na ekranie Konto. Usunięcie jest natychmiastowe i nieodwracalne.',
    removesTitle: 'Co zostanie usunięte',
    removesAccount: 'konto, czyli powiązanie z Twoim logowaniem Google lub Apple,',
    removesProfile: 'profil: pseudonim i zdjęcie, a z nimi Twój wpis w Rankingu Zdobywców,',
    removesFinds: 'odkrycia zapisane w koncie.',
    keepsTitle: 'Co zostaje',
    keepsBody:
      'Kronika zapisana w przeglądarce i w aplikacji na Twoich urządzeniach, bo przechowujemy ją lokalnie, nie na serwerze. Możesz ją wyczyścić, usuwając dane strony w przeglądarce albo odinstalowując aplikację. Nie przechowujemy innych danych o Tobie (patrz polityka prywatności).',
    howTitle: 'Jak usunąć konto',
    howApp: 'W aplikacji: Profil, Konto, Usuń konto, potwierdź.',
    howWeb: 'Na tej stronie: zaloguj się kontem, które chcesz usunąć, naciśnij „Usuń konto” i potwierdź.',
    signInLead: 'Zaloguj się kontem, które chcesz usunąć.',
    contact:
      'Jeśli nie możesz się zalogować, napisz do nas przez Instagram lub Facebook (linki w stopce), podając adres e-mail konta; usuniemy je ręcznie.',
    doneTitle: 'Konto zostało usunięte',
    doneBody: 'Dziękujemy za wspólną wyprawę. Odkrycia zapisane w tej przeglądarce zostały na miejscu.',
    backToGame: 'Wróć do gry',
  },
  gallery: {
    listAria: 'Galeria zdjęć Chatynek',
    openPhoto: 'Powiększ zdjęcie {{index}} z {{count}}',
    lightboxAria: 'Zdjęcie {{index}} z {{count}}',
    closeAria: 'Zamknij podgląd',
    photoAlt: 'Baśniowa chatynka Elfów ukryta w lesie',
    previous: 'Poprzednie zdjęcie',
    next: 'Następne zdjęcie',
  },
}
