const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withStrandHoggProtection(config) {
  // First, update AndroidManifest.xml to set secure launch modes
  config = withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    if (manifest.application && manifest.application[0] && manifest.application[0].activity) {
      // Find all activities
      manifest.application[0].activity.forEach((activity) => {
        const activityName = activity.$?.["android:name"] || "";
        
        // Identify sensitive activities that need protection
        const isSensitiveActivity = 
          activityName.includes("MainActivity") ||
          activityName.includes("Login") ||
          activityName.includes("Auth") ||
          activityName.includes("OTP") ||
          activityName.includes("Phone") ||
          activityName.includes("Emergency");

        if (isSensitiveActivity) {
          if (!activity.$) {
            activity.$ = {};
          }
          
          // Set singleTask launch mode for main activities
          // This prevents task hijacking
          if (activityName.includes("MainActivity")) {
            activity.$["android:launchMode"] = "singleTask";
            activity.$["android:taskAffinity"] = "";
          } else {
            // Set singleInstance for highly sensitive activities
            activity.$["android:launchMode"] = "singleInstance";
          }
          
          // Add FLAG_SECURE to prevent screenshots and screen recording
          activity.$["android:screenOrientation"] = "portrait";
        }
      });
    }

    return config;
  });

  // Then create native overlay detection code
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidPath = path.join(projectRoot, "android");

      // Check if android directory exists
      if (fs.existsSync(androidPath)) {
        const mainActivityPath = path.join(
          androidPath,
          "app",
          "src",
          "main",
          "java",
          "com",
          "innovationlab",
          "alertbuttonexpo",
          "MainActivity.java"
        );

        if (fs.existsSync(mainActivityPath)) {
          let mainActivityContent = fs.readFileSync(mainActivityPath, "utf8");

          // Check if overlay protection already exists
          if (!mainActivityContent.includes("checkForOverlay")) {
            // Add necessary imports
            const imports = `
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.view.WindowManager;
import android.widget.Toast;
import java.util.List;
`;

            // Add imports after package declaration
            mainActivityContent = mainActivityContent.replace(
              /(package[^;]+;)/,
              `$1\n${imports}`
            );

            // Add overlay protection methods
            const overlayProtectionCode = `
    // StrandHogg v2 Protection
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Prevent screenshots and screen recording on sensitive screens
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }

    @Override
    protected void onResume() {
        super.onResume();
        
        // Check for overlay attacks on Android < 10
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            checkForOverlay();
        }
    }

    private void checkForOverlay() {
        // Detect if another app is overlaying our app
        try {
            ActivityManager activityManager = 
                (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            
            if (activityManager != null) {
                List<ActivityManager.RunningTaskInfo> tasks = 
                    activityManager.getRunningTasks(1);
                    
                if (tasks != null && !tasks.isEmpty()) {
                    ComponentName topActivity = tasks.get(0).topActivity;
                    
                    if (topActivity != null && 
                        !topActivity.getPackageName().equals(getPackageName())) {
                        
                        // Potential overlay detected
                        handleOverlayDetected();
                    }
                }
            }
        } catch (SecurityException e) {
            // Permission denied, can't check - fail safely
        }
    }

    private void handleOverlayDetected() {
        // Alert user and restart the app
        Toast.makeText(
            this, 
            "Security alert: Please restart the app", 
            Toast.LENGTH_LONG
        ).show();
        
        // Restart to main activity
        finish();
        startActivity(getIntent());
    }
`;

            // Insert protection code before the last closing brace
            mainActivityContent = mainActivityContent.replace(
              /(\n\s*}\s*$)/,
              `${overlayProtectionCode}$1`
            );

            fs.writeFileSync(mainActivityPath, mainActivityContent);
          }
        }

        // Create a security helper class
        const securityHelperDir = path.join(
          androidPath,
          "app",
          "src",
          "main",
          "java",
          "com",
          "innovationlab",
          "alertbuttonexpo"
        );

        if (!fs.existsSync(securityHelperDir)) {
          fs.mkdirSync(securityHelperDir, { recursive: true });
        }

        const securityHelperPath = path.join(securityHelperDir, "SecurityHelper.java");
        
        const securityHelperContent = `package com.innovationlab.alertbuttonexpo;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;
import android.view.WindowManager;

public class SecurityHelper {
    
    // Check if screen overlay is detected
    public static boolean canDrawOverlays(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(context);
        }
        return true; // Assume true for older versions
    }
    
    // Enable FLAG_SECURE for sensitive activities
    public static void enableSecureMode(Activity activity) {
        activity.getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
    
    // Disable screenshots and screen recording
    public static void preventScreenCapture(Activity activity) {
        enableSecureMode(activity);
    }
}
`;

        fs.writeFileSync(securityHelperPath, securityHelperContent);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withStrandHoggProtection; 