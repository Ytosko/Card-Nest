const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SQLite's SDK 54 web worker loads its database engine as a WebAssembly
// asset. Native bundles ignore this resolver addition.
config.resolver.assetExts.push('wasm');

module.exports = config;
