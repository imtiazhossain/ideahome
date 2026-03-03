const fs = require("fs");
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
    monorepoRoot,
    path.resolve(monorepoRoot, "packages"),
  ],
  resolver: {
    ...defaultConfig.resolver,
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    extraNodeModules: {
      ...defaultConfig.resolver?.extraNodeModules,
      "react-native": path.join(projectRoot, "node_modules", "react-native"),
      "@babel/runtime": path.join(projectRoot, "node_modules", "@babel", "runtime"),
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
      // Explicit resolution for react-native (pnpm symlink workaround)
      if (moduleName === "react-native") {
        const rnIndex = path.join(projectRoot, "node_modules", "react-native", "index.js");
        if (fs.existsSync(rnIndex)) {
          return { filePath: rnIndex, type: "sourceFile" };
        }
      }
      // Explicit resolution for @babel/runtime (pnpm symlink workaround)
      if (moduleName.startsWith("@babel/runtime/")) {
        const subPath = moduleName.slice("@babel/runtime/".length);
        const babelRuntimePath = path.join(projectRoot, "node_modules", "@babel", "runtime");
        const resolved = path.join(babelRuntimePath, subPath);
        const withExt = resolved.endsWith(".js") ? resolved : resolved + ".js";
        if (fs.existsSync(withExt)) {
          return { filePath: withExt, type: "sourceFile" };
        }
        if (fs.existsSync(resolved)) {
          return { filePath: resolved, type: "sourceFile" };
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
