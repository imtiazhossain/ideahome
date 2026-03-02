const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const sharedConfigPath = path.resolve(monorepoRoot, "packages/shared-config");
const sharedAssistantPath = path.resolve(monorepoRoot, "packages/shared-assistant");

const defaultConfig = getDefaultConfig(projectRoot);

/**
 * Metro configuration for monorepo: watch workspace packages and
 * resolve @ideahome/* to real paths so symlinks don't break resolution.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    path.resolve(monorepoRoot, "packages"),
  ],
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      ...defaultConfig.resolver?.extraNodeModules,
      "@ideahome/shared-config": sharedConfigPath,
      "@ideahome/shared-assistant": sharedAssistantPath,
    },
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === "@ideahome/shared-config") {
        return {
          filePath: path.join(sharedConfigPath, "index.js"),
          type: "sourceFile",
        };
      }
      if (moduleName === "@ideahome/shared-assistant") {
        return {
          filePath: path.join(sharedAssistantPath, "index.js"),
          type: "sourceFile",
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
