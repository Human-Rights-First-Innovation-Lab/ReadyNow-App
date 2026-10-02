import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Keys for app settings
// const SETTINGS_KEYS = {
//   LANGUAGE: "app_language",
//   THEME: "app_theme",
//   NOTIFICATIONS: "app_notifications",
// };

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  language: "en" as AppLanguage,
  theme: "light" as AppTheme,
  notifications: true,
};

// Type definitions
export type AppLanguage = "en" | "es" | "kr" | "fr" | "ht" | "zh" | "ar" | "dr" | "ps";
export type AppTheme = "light" | "dark";

export interface AppSettings {
  language: AppLanguage;
  theme: AppTheme;
  notifications: boolean;
}

// Create a context for app settings
const AppSettingsContext = createContext<{
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => Promise<void>;
  isLoading: boolean;
}>({
  settings: DEFAULT_SETTINGS,
  updateSetting: async (_key, _value) => {
    // Placeholder function
    // The actual implementation is provided by the context provider
  },
  isLoading: true,
});

// Export the context
export { AppSettingsContext };

// Custom hook for using app settings
export const useAppSettings = () => useContext(AppSettingsContext);

// Save a single setting
export const saveSetting = async <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> => {
  try {
    const storageKey = `app_${key}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.error(
      `Error saving setting ${key}:`,
      error instanceof Error ? error.message : String(error)
    );
  }
};

// Get a single setting
export const getSetting = async <K extends keyof AppSettings>(
  key: K,
  defaultValue: AppSettings[K]
): Promise<AppSettings[K]> => {
  try {
    const storageKey = `app_${key}`;
    const value = await AsyncStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as AppSettings[K]) : defaultValue;
  } catch (error) {
    console.error(
      `Error getting setting ${key}:`,
      error instanceof Error ? error.message : String(error)
    );
    return defaultValue;
  }
};

// Save all settings
export const saveAllSettings = async (
  settings: Partial<AppSettings>
): Promise<void> => {
  try {
    const promises = Object.entries(settings).map(([key, value]) => {
      const storageKey = `app_${key}`;
      return AsyncStorage.setItem(storageKey, JSON.stringify(value));
    });
    await Promise.all(promises);
  } catch (error) {
    console.error(
      "Error saving all settings:",
      error instanceof Error ? error.message : String(error)
    );
  }
};

// Get all settings
export const getAllSettings = async (): Promise<AppSettings> => {
  try {
    const language = await getSetting("language", DEFAULT_SETTINGS.language);
    const theme = await getSetting("theme", DEFAULT_SETTINGS.theme);
    const notifications = await getSetting(
      "notifications",
      DEFAULT_SETTINGS.notifications
    );

    // Validate that language is a valid AppLanguage
    const validLanguage: AppLanguage = ["en", "es", "kr", "fr", "ht", "zh", "ar", "dr", "ps"].includes(language)
      ? language
      : DEFAULT_SETTINGS.language;

    return {
      language: validLanguage,
      theme,
      notifications,
    };
  } catch (error) {
    console.error(
      "Error getting all settings:",
      error instanceof Error ? error.message : String(error)
    );
    return DEFAULT_SETTINGS;
  }
};

// Function to log app settings
export const logAppSettings = async (): Promise<void> => {
  try {
    const settings = await getAllSettings();

    // Log individual settings with their storage keys
    const language = await AsyncStorage.getItem("app_language");
    const theme = await AsyncStorage.getItem("app_theme");
    const notifications = await AsyncStorage.getItem("app_notifications");
  } catch (error) {
    console.error(
      "Error logging app settings:",
      error instanceof Error ? error.message : String(error)
    );
  }
};

// Provider component for app settings
export const AppSettingsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await getAllSettings();
      setSettings(loadedSettings);
      setIsLoading(false);
    };

    void loadSettings();
  }, []);

  // Update a single setting
  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await saveSetting(key, value);
  };

  return (
    <AppSettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export default AppSettingsProvider;
