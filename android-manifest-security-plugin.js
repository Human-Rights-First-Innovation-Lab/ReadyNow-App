const { withAndroidManifest } = require("@expo/config-plugins");

function withAndroidManifestSecurity(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    // Fix broadcast receivers security
    if (manifest.application && manifest.application[0]) {
      const application = manifest.application[0];

      // Find all receivers and ensure they have android:exported properly set
      if (application.receiver) {
        application.receiver.forEach((receiver) => {
          if (!receiver.$) {
            receiver.$ = {};
          }

          // Set android:exported to false for security
          // This prevents other apps from sending broadcasts to your receivers
          receiver.$["android:exported"] = "false";

          // Exception: if receiver has intent-filters for system broadcasts,
          // it might need to be exported. Handle specific cases:
          if (receiver["intent-filter"]) {
            const hasSystemActions = receiver["intent-filter"].some((filter) => {
              if (filter.action) {
                return filter.action.some((action) => {
                  const actionName = action.$?.["android:name"] || "";
                  // System actions that require exported=true
                  return (
                    actionName.includes("android.intent.action.BOOT_COMPLETED") ||
                    actionName.includes("android.intent.action.MY_PACKAGE_REPLACED") ||
                    actionName.includes("android.intent.action.PACKAGE_REPLACED") ||
                    actionName.includes("android.net.conn.CONNECTIVITY_CHANGE")
                  );
                });
              }
              return false;
            });

            // Only export if absolutely necessary for system broadcasts
            if (hasSystemActions) {
              receiver.$["android:exported"] = "true";
            }
          }
        });
      }

      // Fix services that might register receivers at runtime
      if (application.service) {
        application.service.forEach((service) => {
          if (!service.$) {
            service.$ = {};
          }
          // Ensure services are not exported unless necessary
          if (!service.$["android:exported"]) {
            service.$["android:exported"] = "false";
          }
        });
      }

      // Add security configurations to application
      if (!application.$) {
        application.$ = {};
      }

      // Ensure application doesn't allow backup (security best practice)
      application.$["android:allowBackup"] = "false";
      
      // Prevent debugging in production
      if (process.env.NODE_ENV === "production") {
        application.$["android:debuggable"] = "false";
      }
    }

    return config;
  });
}

module.exports = withAndroidManifestSecurity; 