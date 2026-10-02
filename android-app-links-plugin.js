const { withAndroidManifest } = require("@expo/config-plugins");

function withAndroidAppLinks(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    if (manifest.application && manifest.application[0] && manifest.application[0].activity) {
      // Find MainActivity
      const mainActivity = manifest.application[0].activity.find(
        (activity) => 
          activity.$?.["android:name"] === ".MainActivity" || 
          activity.$?.["android:name"] === "com.innovationlab.alertbuttonexpo.MainActivity"
      );

      if (mainActivity && mainActivity["intent-filter"]) {
        // Remove existing unverified custom scheme intent filters
        mainActivity["intent-filter"] = mainActivity["intent-filter"].filter((filter) => {
          // Keep Auth0 HTTPS intent filters (already verified)
          if (filter.data && filter.data[0] && filter.data[0].$) {
            const scheme = filter.data[0].$["android:scheme"];
            const host = filter.data[0].$["android:host"];
            
            // Keep Auth0 HTTPS intent filter
            if (scheme === "https" && host === "hrf-alt-dev.us.auth0.com") {
              return true;
            }
            
            // Remove unverified custom schemes
            if (scheme === "myapp" || scheme === "exp+alert-button-expo") {
              return false;
            }
          }
          return true;
        });

        // Note: No custom domain App Links added since this is an Expo mobile app
        // Security is achieved by removing vulnerable custom schemes and keeping only verified Auth0 HTTPS
      }
    }

    return config;
  });
}

module.exports = withAndroidAppLinks; 