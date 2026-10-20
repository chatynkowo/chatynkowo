/* Polish copy that exists only on the site: page meta, the skip link, the
   invitation to install the app, the profile page's own words (the account
   block itself is shared), the photo gallery. Merged with the shared set
   into the site's "translation" namespace. */
export const webPl = {
  meta: {
    homeTitle: 'Chatynkowo | Baśniowa gra terenowa w Jurze Krakowsko-Częstochowskiej',
    homeDescription:
      'Baśniowa gra terenowa w Jurze Krakowsko-Częstochowskiej. Odszukuj ukryte Chatynki — domy prawdziwych Elfów — zdobywaj pieczęcie i otwieraj ich opowieści. Aplikacja już w Google Play.',
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
  /* The invitation to install the app: what the app adds to the site's
     game, and the store it is published in. Only Google Play for now. */
  app: {
    /* The ribbon under the header: the first thing a visitor sees. */
    ribbonAria: 'Aplikacja Chatynkowo jest dostępna',
    ribbonTitle: 'Aplikacja Chatynkowo',
    ribbonText: 'Już dostępna w Google Play',
    ribbonMore: 'Co potrafi?',
    ribbonDownload: 'Pobierz',
    sectionAria: 'Aplikacja Chatynkowo',
    eyebrow: 'Nowość',
    title: 'Chatynkowo masz teraz w kieszeni',
    lead:
      'Aplikacja Chatynkowo jest już w Google Play. Zabierz ją na szlak: wpisz kod z tabliczek, nawiguj do najbliższej Chatynki i ciesz się przygodą także tam, gdzie nie ma zasięgu.',
    download: 'Pobierz z Google Play',
    downloadAria: 'Pobierz aplikację Chatynkowo z Google Play (otwiera się w nowej karcie)',
    appStoreSoon: 'App Store wkrótce',
    /* Competition stands for the ranking today and for whatever the app
       grows into later, so the title names the idea, not the feature. */
    perk1Title: 'Rywalizuj z innymi',
    perk1Body: 'Ranking Zdobywców masz pod ręką: sprawdź, kto odkrył najwięcej Chatynek, i zajmij w nim swoje miejsce.',
    perk2Title: 'Mapa bez zasięgu',
    perk2Body: 'Po pierwszym uruchomieniu Chatynki zostają w telefonie. Kody sprawdzamy także offline.',
    perk3Title: 'Trop do najbliższej Chatynki',
    perk3Body: 'Kompas wyprawy pokazuje, w którą stronę i jak daleko do najbliższego Elfa.',
    perk4Title: 'Jedna Kronika wszędzie',
    perk4Body: 'Zaloguj się tym samym kontem, a odkrycia ze strony i z aplikacji spotkają się w jednej Kronice.',
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
