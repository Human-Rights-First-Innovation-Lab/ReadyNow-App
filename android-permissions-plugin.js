const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Android Permissions Security Plugin
 * Removes unnecessary dangerous permissions and optimizes location permissions
 */
function withAndroidPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;
    
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    // Define dangerous permissions to remove
    const dangerousPermissionsToRemove = [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      // Note: We keep location permissions for emergency alerts
    ];

    // Remove dangerous storage permissions
    manifest["uses-permission"] = manifest["uses-permission"].filter(perm => {
      if (perm.$ && dangerousPermissionsToRemove.includes(perm.$["android:name"])) {
        return false;
      }
      return true;
    });

    // Ensure required permissions are present with proper configuration
    const requiredPermissions = [
      {
        name: "android.permission.INTERNET",
        reason: "Required for API calls and alerts"
      },
      {
        name: "android.permission.VIBRATE",
        reason: "Required for alert notifications"
      },
      {
        name: "android.permission.USE_BIOMETRIC",
        reason: "Required for secure authentication"
      },
      {
        name: "android.permission.ACCESS_FINE_LOCATION",
        reason: "Required for emergency location sharing",
        maxSdkVersion: undefined // Available on all SDK versions
      },
      {
        name: "android.permission.ACCESS_COARSE_LOCATION",
        reason: "Fallback for location services"
      },
      // For Android 13+ (API 33+), add granular media permissions if needed
      // These are safer than broad storage permissions
      {
        name: "android.permission.POST_NOTIFICATIONS",
        reason: "Required for alert notifications on Android 13+"
      }
    ];

    // Add required permissions if missing
    requiredPermissions.forEach(reqPerm => {
      const exists = manifest["uses-permission"].some(
        perm => perm.$ && perm.$["android:name"] === reqPerm.name
      );
      
      if (!exists) {
        const permission = {
          $: {
            "android:name": reqPerm.name
          }
        };
        
        if (reqPerm.maxSdkVersion !== undefined) {
          permission.$["android:maxSdkVersion"] = reqPerm.maxSdkVersion;
        }
        
        manifest["uses-permission"].push(permission);
      }
    });

    // Add feature declarations for location (helps with app store filtering)
    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }

    // Declare location features as optional (app works without them)
    const locationFeatures = [
      {
        name: "android.hardware.location",
        required: "false"
      },
      {
        name: "android.hardware.location.gps",
        required: "false"
      },
      {
        name: "android.hardware.location.network",
        required: "false"
      }
    ];

    locationFeatures.forEach(feature => {
      const exists = manifest["uses-feature"].some(
        f => f.$ && f.$["android:name"] === feature.name
      );
      
      if (!exists) {
        manifest["uses-feature"].push({
          $: {
            "android:name": feature.name,
            "android:required": feature.required
          }
        });
      }
    });

    
    return config;
  });
}

module.exports = withAndroidPermissions; 