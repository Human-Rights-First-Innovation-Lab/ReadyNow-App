const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Temporarily disable Sentry Metro integration due to countLines issue with Expo SDK 54
// TODO: Re-enable when Sentry fixes compatibility with Metro 0.83
// const { withSentryConfig } = require("@sentry/react-native/metro");
// const config = withSentryConfig(baseConfig);

// Add additional extensions to assetExts list
config.resolver.assetExts.push("cjs");

// Exclude debug files from bundle for security
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Block debug files from being served
      const debugFiles = [
        'DebugProbesKt.bin',
        'kotlin-tooling-metadata.json',
        '.kotlin_module',
        'debug-metadata',
        'coroutines-debug'
      ];
      
      const isDebugFile = debugFiles.some(debugFile => 
        req.url.includes(debugFile) || req.url.includes('debug')
      );
      
      if (isDebugFile) {
        res.statusCode = 404;
        res.end();
        return;
      }
      
      return middleware(req, res, next);
    };
  },
};

// Exclude debug components and test files from resolver
config.resolver = {
  ...config.resolver,
  blockList: [
    /DebugProbesKt\.bin$/,
    /kotlin-tooling-metadata\.json$/,
    /META-INF\/.*\.kotlin_module$/,
    /META-INF\/.*\.version$/,
    // Exclude test files
    /__tests__\/.*/,
    /.*\.test\.(ts|tsx|js|jsx)$/,
    /.*\.spec\.(ts|tsx|js|jsx)$/,
  ],
};

module.exports = config;