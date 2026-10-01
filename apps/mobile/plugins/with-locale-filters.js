/* Keeps only the app's own languages in the Android resources.

   The Android libraries the app builds on (AndroidX, Play Services, the
   camera and sign-in stacks) ship their strings in some eighty languages,
   which an APK carries in full unless the build says which ones it
   needs: a couple of megabytes of resource tables for an app that speaks
   two languages. This plugin writes the Android Gradle plugin's locale
   filter into the generated app/build.gradle, with the languages read from
   `expo.locales` in app.json (the same list that gives iOS its localized
   permission strings), so the languages are declared once.

   Google Play does the same split per device from an app bundle; the
   filter matters for an APK installed by hand and for the build's own
   size. The plugin is safe to run repeatedly (it replaces its own block)
   and fails loudly when the template no longer has the `android` block it
   expects, so a template change cannot pass unnoticed. */
const { withAppBuildGradle } = require('expo/config-plugins')

const PLUGIN = 'with-locale-filters'
const BEGIN = `    // @generated begin ${PLUGIN}`
const END = `    // @generated end ${PLUGIN}`
const BLOCK = new RegExp(`${escape(BEGIN)}[\\s\\S]*?${escape(END)}\\n`)
const ANDROID_BLOCK = /^android \{\n/m

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function localeFiltersBlock(locales) {
  const list = locales.map((locale) => `"${locale}"`).join(', ')
  return [
    BEGIN,
    '    // The languages the app ships (expo.locales in app.json); the',
    '    // libraries\' strings in every other language stay out of the build.',
    '    androidResources {',
    `        localeFilters += [${list}]`,
    '    }',
    END,
    '',
  ].join('\n')
}

module.exports = function withLocaleFilters(config) {
  const locales = Object.keys(config.locales ?? {})
  if (locales.length === 0) {
    throw new Error(`${PLUGIN}: expo.locales in app.json is empty; it is where the app's languages are declared`)
  }
  return withAppBuildGradle(config, (config) => {
    const block = localeFiltersBlock(locales)
    const contents = config.modResults.contents
    if (BLOCK.test(contents)) {
      config.modResults.contents = contents.replace(BLOCK, block)
    } else if (ANDROID_BLOCK.test(contents)) {
      config.modResults.contents = contents.replace(ANDROID_BLOCK, (line) => line + block)
    } else {
      throw new Error(`${PLUGIN}: app/build.gradle has no \`android {\` block to add the locale filter to`)
    }
    return config
  })
}
