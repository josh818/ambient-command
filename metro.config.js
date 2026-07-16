const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Path aliases (@/*) are resolved automatically from tsconfig.json paths
// via Expo CLI's built-in tsconfigPaths support (enabled by default).
// No manual alias config needed in Metro.

module.exports = withNativeWind(config, { input: "./global.css" });


