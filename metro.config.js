const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SDK 54/Metro can emit the internal empty-module path into the graph.
// Keep it slash-normalised so Windows PowerShell runs do not hand Metro a
// backslash-heavy absolute path that it then treats as an unresolved module id.
if (config.resolver && config.resolver.emptyModulePath) {
  config.resolver.emptyModulePath = config.resolver.emptyModulePath.replace(/\\/g, '/');
}

module.exports = config;
