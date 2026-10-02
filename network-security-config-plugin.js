const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withNetworkSecurityConfig(config) {
  // Create the network security config XML file
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidPath = path.join(projectRoot, "android");

      // Check if android directory exists (after expo prebuild)
      if (fs.existsSync(androidPath)) {
        // Release builds: no cleartext anywhere, no exemptions.
        const releaseConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>`;

        // Debug builds only: the Metro bundler and an emulator host are
        // reached over plain HTTP. 10.0.2.2 is the host loopback as seen from
        // the Android emulator. Android's <debug-overrides> cannot express
        // cleartextTrafficPermitted - it only carries trust-anchors - so this
        // is scoped by build variant instead: res/xml under src/debug
        // overrides src/main for debuggable builds only, and is not packaged
        // into a release APK/AAB at all.
        const debugConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>`;

        for (const [variant, contents] of [
          ["main", releaseConfig],
          ["debug", debugConfig],
        ]) {
          const xmlPath = path.join(
            androidPath,
            "app",
            "src",
            variant,
            "res",
            "xml"
          );
          if (!fs.existsSync(xmlPath)) {
            fs.mkdirSync(xmlPath, { recursive: true });
          }
          fs.writeFileSync(
            path.join(xmlPath, "network_security_config.xml"),
            contents
          );
        }
      }

      return config;
    },
  ]);

  // Update AndroidManifest.xml to reference the network security config
  config = withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    if (manifest.application) {
      // Add network security config and disable cleartext traffic
      manifest.application[0].$ = {
        ...manifest.application[0].$,
        "android:networkSecurityConfig": "@xml/network_security_config",
        "android:usesCleartextTraffic": "false",
      };
    }

    return config;
  });

  return config;
}

module.exports = withNetworkSecurityConfig;
