/* Hermes ships without Intl.DisplayNames, which the cottage panel uses to
   name a cottage's country the way the site does; FormatJS fills it in for
   the languages the app ships. Imported once, from the entry point. */
import '@formatjs/intl-getcanonicallocales/polyfill'
import '@formatjs/intl-locale/polyfill'
import '@formatjs/intl-displaynames/polyfill'
import '@formatjs/intl-displaynames/locale-data/pl'
import '@formatjs/intl-displaynames/locale-data/en'
