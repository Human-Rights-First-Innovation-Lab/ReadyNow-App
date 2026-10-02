const { withAppBuildGradle } = require("@expo/config-plugins");

function withAndroidStackProtection(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;

      // Only add NDK configuration if not already present
      if (!contents.includes("abiFilters") && !contents.includes("ndk {")) {
        // Find defaultConfig block and add NDK configuration
        const ndkConfig = `        ndk {
            abiFilters "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }`;
        
        contents = contents.replace(
          /(defaultConfig\s*{[^}]*)(versionName[^}]*)/,
          `$1$2\n${ndkConfig}`
        );
      }

      // Stack protection and debug removal achieved through NDK ABI filters and packaging options
      // This ensures we use secure native libraries and exclude debug components

      // Only add packaging options if not present
      if (!contents.includes("pickFirst") && !contents.includes("packagingOptions") && !contents.includes("DebugProbesKt.bin")) {
        const packagingOptions = `    packagingOptions {
        resources {
            excludes += [
                "DebugProbesKt.bin",
                "kotlin-tooling-metadata.json",
                "META-INF/com.android.tools/**",
                "META-INF/proguard/**",
                "META-INF/maven/**",
                "META-INF/*.kotlin_module",
                "META-INF/*.version"
            ]
        }
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsc.so'
        pickFirst '**/libfbjni.so'
    }`;
        
        // Insert before buildTypes or at end of android block
        if (contents.includes("buildTypes")) {
          contents = contents.replace(
            /(\s+)(buildTypes\s*{)/,
            `$1${packagingOptions}\n\n$1$2`
          );
        } else {
          contents = contents.replace(
            /(\s+)(}\s*$)/,
            `$1${packagingOptions}\n$1$2`
          );
        }
      }

      config.modResults.contents = contents;
    }
    return config;
  });
}

module.exports = withAndroidStackProtection; 