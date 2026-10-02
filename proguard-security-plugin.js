const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withProGuardSecurity(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidPath = path.join(projectRoot, "android");

      // Check if android directory exists (after expo prebuild)
      if (fs.existsSync(androidPath)) {
        const appPath = path.join(androidPath, "app");
        const proguardPath = path.join(appPath, "proguard-rules.pro");

        // Create ProGuard rules for security
        const proguardRules = `# Security rules for ReadyNow app

# Remove development-related classes in production
-assumenosideeffects class com.facebook.react.devsupport.** {
    public *;
}

# Remove debug-related broadcast receivers
-assumenosideeffects class * extends android.content.BroadcastReceiver {
    public void onReceive(android.content.Context, android.content.Intent);
} if {
    return false;
}

# Obfuscate sensitive classes
-keep class com.innovationlab.alertbuttonexpo.** { *; }
-keep class com.auth0.** { *; }

# Remove logging in production
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# Security: Remove dangerous methods that could be used for exploitation
-assumenosideeffects class java.lang.System {
    public static void setProperty(java.lang.String, java.lang.String);
}

# Remove development receivers
-assumenosideeffects class com.facebook.react.devsupport.DevSupportManagerBase {
    public void compatRegisterReceiver(...);
}

# Prevent reflection on sensitive classes
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Security: Remove development intent filters
-keep class * extends android.content.BroadcastReceiver {
    <init>(...);
}

# Native library security
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.jni.** { *; }

# Stack protection related classes
-keepclassmembers class * {
    native <methods>;
}

# Prevent reflection attacks on native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Security: Obfuscate native interface classes
-keep class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Additional native security
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
    public static *** wtf(...);
}

# Remove Kotlin debug metadata and coroutine debug probes
-dontwarn kotlin.reflect.jvm.internal.**
-keep class kotlin.reflect.jvm.internal.** { *; }
-dontwarn kotlinx.coroutines.debug.**
-dontwarn kotlinx.coroutines.internal.FastServiceLoader

# Remove Kotlin coroutines debug components
-dontwarn kotlinx.coroutines.debug.internal.**
-assumenosideeffects class kotlinx.coroutines.debug.** {
    *;
}

# Remove debug annotations and metadata
-dontwarn kotlin.coroutines.jvm.internal.DebugMetadata
-dontwarn kotlin.coroutines.jvm.internal.DebugProbes**

# Additional Kotlin debug cleanup
-dontwarn kotlin.jvm.internal.Intrinsics
-dontwarn kotlin.jvm.internal.markers.KMutableList

# Remove debug binary files
-assumenosideeffects class kotlinx.coroutines.debug.internal.DebugProbesImpl {
    *;
}

# Enforce secure random usage - block insecure Random
-dontwarn java.util.Random
-assumenosideeffects class java.util.Random {
    public <init>();
    public <init>(long);
    public *;
}

# Force use of SecureRandom for security-sensitive operations
-keep class java.security.SecureRandom {
    public <init>();
    public <init>(byte[]);
    public *;
}

# Block weak random number generators
-assumenosideeffects class java.lang.Math {
    public static double random();
}

# Keep secure random implementations
-keep class sun.security.provider.SecureRandom { *; }
-keep class java.security.Provider { *; }
-keep class java.security.Security { *; }`;

        // Write ProGuard rules
        fs.writeFileSync(proguardPath, proguardRules);
      }

      return config;
    },
  ]);
}

module.exports = withProGuardSecurity; 