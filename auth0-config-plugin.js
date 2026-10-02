const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withAuth0Config(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      // Add manifestPlaceholders to the android block
      const androidBlock = config.modResults.contents.match(
        /android\s*{[\s\S]*?defaultConfig\s*{([\s\S]*?)}/
      );

      if (androidBlock) {
        const manifestPlaceholders = `
        manifestPlaceholders = [
            auth0Domain: "hrf-alt-dev.us.auth0.com",
            auth0Scheme: "myapp"
        ]`;

        // Insert manifestPlaceholders into defaultConfig
        config.modResults.contents = config.modResults.contents.replace(
          /(defaultConfig\s*{[\s\S]*?)(})/,
          `$1${manifestPlaceholders}\n    $2`
        );
      }
    }
    return config;
  });
};
