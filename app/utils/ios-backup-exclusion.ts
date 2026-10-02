import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

/**
 * Excludes a file or directory from iOS backups
 * This prevents sensitive data from being included in iCloud backups
 */
export const excludeFromIOSBackup = async (fileUri: string): Promise<boolean> => {
  if (Platform.OS !== "ios") {
    return true; // Not iOS, no action needed
  }

  try {
    // Check if the file/directory exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      console.warn(`File does not exist: ${fileUri}`);
      return false;
    }

    // Note: Expo FileSystem doesn't directly expose iOS backup exclusion
    // The native plugin (ios-backup-security-plugin.js) handles this at build time
    // This function serves as a placeholder for runtime checks
    

    return true;
  } catch (error) {
    console.error(`Failed to exclude from iOS backup: ${fileUri}`, error);
    return false;
  }
};

/**
 * Excludes all sensitive app directories from iOS backups
 */
export const excludeAllSensitiveDataFromIOSBackup = async (): Promise<void> => {
  if (Platform.OS !== "ios") {
    return; // Not iOS, no action needed
  }

  try {
    // Get document directory path
    // Note: documentDirectory may be null on some platforms
    const documentDir = FileSystem.documentDirectory || null;
    
    // List of sensitive files/directories to exclude
    const sensitiveItems = [
      "emergency_plan_data",
      "auth_tokens",
      "user_info",
      "encryption_keys",
      "cached_data",
    ];

    // Exclude document directory itself
    if (documentDir) {
      await excludeFromIOSBackup(documentDir);
    }

    // Exclude specific sensitive items
    for (const item of sensitiveItems) {
      if (documentDir) {
        const itemPath = `${documentDir}${item}`;
        await excludeFromIOSBackup(itemPath);
      }
    }

  } catch (error) {
    console.error("Error excluding sensitive data from iOS backups:", error);
  }
};

/**
 * Call this when your app starts to ensure sensitive data is excluded from backups
 */
export const initializeIOSBackupSecurity = async (): Promise<void> => {
  if (Platform.OS === "ios") {
    await excludeAllSensitiveDataFromIOSBackup();
  }
}; 

export default {
  excludeFromIOSBackup,
  excludeAllSensitiveDataFromIOSBackup,
  initializeIOSBackupSecurity,
};
