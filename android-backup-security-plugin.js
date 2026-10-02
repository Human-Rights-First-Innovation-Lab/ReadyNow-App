const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withAndroidBackupSecurity(config) {
  // First, update AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    if (manifest.application && manifest.application[0] && manifest.application[0].$) {
      // Disable backup entirely for security
      manifest.application[0].$["android:allowBackup"] = "false";
      manifest.application[0].$["android:fullBackupContent"] = "false";
      
      // Add data extraction rules for API 31+ compliance
      manifest.application[0].$["android:dataExtractionRules"] = "@xml/data_extraction_rules";
      
    }

    return config;
  });

  // Then create the data extraction rules XML file
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidPath = path.join(projectRoot, "android");

      // Check if android directory exists (after expo prebuild)
      if (fs.existsSync(androidPath)) {
        const xmlPath = path.join(androidPath, "app", "src", "main", "res", "xml");
        
        // Create xml directory if it doesn't exist
        if (!fs.existsSync(xmlPath)) {
          fs.mkdirSync(xmlPath, { recursive: true });
        }

        // Create data extraction rules file
        const dataExtractionRulesPath = path.join(xmlPath, "data_extraction_rules.xml");
        
        const dataExtractionRulesContent = `<?xml version="1.0" encoding="utf-8"?>
<!-- 
  Security: Disable all cloud backups and device transfers
  This prevents sensitive emergency plan data from being exposed
-->
<data-extraction-rules>
    <cloud-backup>
        <!-- Disable cloud backup entirely for security -->
        <exclude domain="file" path="." />
        <exclude domain="database" path="." />
        <exclude domain="sharedpref" path="." />
        <exclude domain="external" path="." />
        <exclude domain="root" path="." />
    </cloud-backup>
    <device-transfer>
        <!-- Disable device transfer for security -->
        <exclude domain="file" path="." />
        <exclude domain="database" path="." />
        <exclude domain="sharedpref" path="." />
        <exclude domain="external" path="." />
        <exclude domain="root" path="." />
    </device-transfer>
</data-extraction-rules>`;

        fs.writeFileSync(dataExtractionRulesPath, dataExtractionRulesContent);

        // Also create a legacy backup rules file for older Android versions
        const backupRulesPath = path.join(xmlPath, "backup_rules.xml");
        
        const backupRulesContent = `<?xml version="1.0" encoding="utf-8"?>
<!-- 
  Security: Legacy backup rules for older Android versions
  This excludes all data from backup
-->
<full-backup-content>
    <!-- Exclude everything for security -->
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
    <exclude domain="root" path="." />
</full-backup-content>`;

        fs.writeFileSync(backupRulesPath, backupRulesContent);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidBackupSecurity; 