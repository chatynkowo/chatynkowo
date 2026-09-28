/* Metro in the pnpm monorepo: watch the repository root so the workspace
   packages (@chatynkowo/core, api, i18n — TypeScript sources, no build
   step) are bundled together with the app, and resolve modules from both
   the app's and the root node_modules. */
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = config
