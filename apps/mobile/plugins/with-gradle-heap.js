/* Gives the Gradle daemon the heap a release build needs.

   The generated android/gradle.properties allows the daemon 2 GB, which
   R8 (the minifier the release variant runs, see expo-build-properties in
   app.json) runs out of once the map, the camera, the sign-in, the ads and
   the billing stacks are all in the shrinker's input: the build dies with
   "Java heap space" on minifyReleaseWithR8. This plugin writes a larger
   limit into the generated file, the same for a local build and for an
   EAS worker, so the setting is declared once instead of being patched
   by hand after every prebuild. Safe to run repeatedly: the property is
   replaced in place. */
const { withGradleProperties } = require('expo/config-plugins')

const KEY = 'org.gradle.jvmargs'
const VALUE = '-Xmx4g -XX:MaxMetaspaceSize=1g'

module.exports = function withGradleHeap(config) {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults.filter((item) => !(item.type === 'property' && item.key === KEY))
    properties.push({ type: 'property', key: KEY, value: VALUE })
    config.modResults = properties
    return config
  })
}
