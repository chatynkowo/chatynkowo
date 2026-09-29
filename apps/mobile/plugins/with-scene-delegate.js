/* Adopts the UIScene life cycle in the generated iOS project.

   The iOS 27 SDK (Xcode 27) asserts at launch unless the app has a scene
   delegate; the SDK 57 bare template still starts React Native from the app
   delegate, so the dev client crashes before the splash screen. Expo 57.0.25
   ships `ExpoAppSceneDelegate`, which creates the window and starts React
   Native from the scene, and `ExpoReactNativeFactoryProvider`, through which
   it reaches the factory the app delegate created. This plugin wires the
   three pieces the way the SDK 58 template does: the AppDelegate conforms to
   the provider protocol and stops starting React Native itself, a
   SceneDelegate subclasses ExpoAppSceneDelegate, and Info.plist declares the
   UIApplicationSceneManifest.

   It is safe to run repeatedly (every step checks the current state first),
   it refuses to run on an expo older than 57.0.25 (the scene delegate does
   not exist there), it does nothing from SDK 58 on (the template adopts the
   scene life cycle itself), and it warns instead of failing when the
   AppDelegate template no longer matches, so a template change cannot break
   prebuild. Drop it on the next SDK upgrade. */
const fs = require('node:fs')
const path = require('node:path')
const { IOSConfig, withAppDelegate, withInfoPlist, withXcodeProject } = require('expo/config-plugins')

const PLUGIN = 'with-scene-delegate'
const MIN_EXPO_VERSION = '57.0.25'
const FIRST_SDK_WITH_SCENES = 58

const SCENE_DELEGATE_FILE = 'SceneDelegate.swift'

/* The manifest resolves the class through the Swift module name, so no
   @objc attribute is needed: one name, one lookup path, as in Apple's own
   template. */
const SCENE_DELEGATE_SOURCE = `internal import Expo

class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
}

/* The block of the SDK 57 template that creates the window and starts
   React Native from the app delegate; the scene delegate takes it over. */
const START_FROM_APP_DELEGATE =
  /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\n#endif\n/

const START_FROM_SCENE_NOTE =
  '    // The window is created and React Native is started by SceneDelegate\n' +
  '    // (UIScene life cycle, required by the iOS 27 SDK).\n'

/* Numeric compare of dotted versions; prerelease suffixes are ignored. */
function compareVersions(a, b) {
  const left = String(a).split('.').map((part) => Number.parseInt(part, 10) || 0)
  const right = String(b).split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/* The expo the project actually installs, resolved from the project root
   rather than from this file, so a hoisted or duplicated copy cannot fool
   the check. */
function installedExpoVersion(config) {
  const projectRoot = config._internal?.projectRoot ?? path.resolve(__dirname, '..')
  const packageJson = require.resolve('expo/package.json', { paths: [projectRoot] })
  return require(packageJson).version
}

function majorSdkVersion(config) {
  return Number.parseInt(String(config.sdkVersion ?? '57').split('.')[0], 10)
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error(`${PLUGIN}: the AppDelegate must be Swift`)
    }
    let contents = config.modResults.contents
    // Already rewired (a previous prebuild without --clean).
    if (contents.includes('ExpoReactNativeFactoryProvider')) return config

    if (!START_FROM_APP_DELEGATE.test(contents) || !contents.includes('class AppDelegate: ExpoAppDelegate {')) {
      console.warn(`${PLUGIN}: AppDelegate template changed, skipping`)
      return config
    }
    contents = contents.replace(
      'class AppDelegate: ExpoAppDelegate {',
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
    )
    contents = contents.replace(START_FROM_APP_DELEGATE, START_FROM_SCENE_NOTE)
    config.modResults.contents = contents
    return config
  })
}

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    // Another plugin or an earlier run may already declare the scenes.
    if (config.modResults.UIApplicationSceneManifest) return config
    config.modResults.UIApplicationSceneManifest = SCENE_MANIFEST
    return config
  })
}

function withSceneDelegateSource(config) {
  return withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.projectRoot
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot)
    const sourceRoot = IOSConfig.Paths.getSourceRoot(projectRoot)
    const sourcePath = path.join(sourceRoot, SCENE_DELEGATE_FILE)

    // Introspection must not touch the file system.
    if (!config.modRequest.introspect) {
      const current = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : null
      if (current !== SCENE_DELEGATE_SOURCE) fs.writeFileSync(sourcePath, SCENE_DELEGATE_SOURCE)
    }

    const filepath = `${projectName}/${SCENE_DELEGATE_FILE}`
    if (!config.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: config.modResults,
      })
    }
    return config
  })
}

module.exports = function withSceneDelegate(config) {
  // From SDK 58 the template ships the scene life cycle itself.
  if (majorSdkVersion(config) >= FIRST_SDK_WITH_SCENES) return config

  const expoVersion = installedExpoVersion(config)
  if (compareVersions(expoVersion, MIN_EXPO_VERSION) < 0) {
    throw new Error(
      `${PLUGIN}: expo ${expoVersion} is installed but ExpoAppSceneDelegate first shipped in ` +
        `expo ${MIN_EXPO_VERSION}; upgrade expo or remove the plugin from app.json`,
    )
  }
  return withSceneDelegateSource(withSceneManifest(withSceneAppDelegate(config)))
}
