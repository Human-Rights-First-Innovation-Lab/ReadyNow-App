import React, { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import EmergencyPlanBottomNavigation from "../components/EmergencyPlanBottomNavigation";
import SettingsTab from "../components/SettingsTab";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";
import { useAuth } from "../utils/use-auth";
import { useModal } from "../context/ModalContext";
import { resetEmergencyPlanData, clearAdditionalLegalHelp } from "../utils/storage-utils";
import { STORAGE_KEYS } from "../utils/auth-service";
import type { AppLanguage } from "../utils/app-settings";
import { disableDevicePushToken } from "../utils/notifications";
import {
  getCrashReportingConsent,
  setCrashReportingConsent,
} from "../utils/crash-reporting";

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const showEmergencyPlanNav = params.fromEmergencyPlan === "true";
  const { settings, updateSetting } = useAppSettings();
  const { t } = usePageTranslation("main", settings.language);
  const { signOut, user } = useAuth();
  const { showConfirm, showError } = useModal();
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(
    settings.language
  );
  const [crashReportingEnabled, setCrashReportingEnabled] = useState(
    () => getCrashReportingConsent() === "granted"
  );

  const handleToggleCrashReporting = async () => {
    const next = !crashReportingEnabled;

    try {
      await setCrashReportingConsent(next);
      setCrashReportingEnabled(next);
    } catch (error) {
      console.error(
        "Could not update crash reporting preference:",
        error instanceof Error ? error.message : String(error)
      );
      showError(
        "Could not update your crash reporting preference. Please try again."
      );
    }
  };

  const languages = [
    { label: "English", value: "en" },
    { label: "Español", value: "es" },
    { label: "한국어", value: "kr" },
    { label: "Français", value: "fr" },
    { label: "Kreyòl", value: "ht" },
    { label: "中文", value: "zh" },
    { label: "العربية", value: "ar" },
    { label: "دری", value: "dr" },
    { label: "پښتو", value: "ps" },
  ];

  const handleLanguageChange = async (value: string) => {
    setSelectedLanguage(value as AppLanguage);
    await updateSetting("language", value as AppLanguage);
  };

  const handleSignOut = () => {
    showConfirm(
      t("signOut"),
      t("signOutConfirmation"),
      async () => {
        try {
          // Clear emergency plan data
          await resetEmergencyPlanData();
          await clearAdditionalLegalHelp();

          await disableDevicePushToken({
            requireBiometric: false,
            userId: user?.userId,
          });

          // Clear auth tokens and user info
          for (const key of Object.values(STORAGE_KEYS)) {
            try {
              await SecureStore.deleteItemAsync(key);
            } catch (error) {
              // Some keys might not exist, continue with others
            }
          }

          // Clear app settings using AsyncStorage
          const appSettingsKeys = [
            "app_language",
            "app_theme", 
            "app_notifications",
          ];
          for (const key of appSettingsKeys) {
            try {
              await AsyncStorage.removeItem(key);
            } catch (error) {
            }
          }

          // Clear encryption keys
          try {
            await SecureStore.deleteItemAsync("emergency_plan_encryption_key");
          } catch (error) {
          }

          // Clear other app flags
          try {
            await SecureStore.deleteItemAsync("emergency_plan_completed");
            await SecureStore.deleteItemAsync("has_legal_support");
            await SecureStore.deleteItemAsync("selected_additional_topics");
            await SecureStore.deleteItemAsync("emergency_plan_data");
            await SecureStore.deleteItemAsync("user_data");
          } catch (error) {
          }

          // Sign out user
          await signOut();

          // Navigate to welcome screen
          router.replace("/screens/welcome/welcome" as any);
        } catch (error) {
          console.error("Error during sign out:", error);
          showError("There was a problem signing out. Please try again.");
        }
      }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
      <Stack.Screen
        options={{
          title: t("settings"),
          headerTitleAlign: "center",
          headerStyle: {
            backgroundColor: "#f0f0f2",
          },
          headerTintColor: "#5a69cc",
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 20,          },
        }}
      />
      <View style={{ flex: 1 }} className="bg-white">
        <SettingsTab
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
          onSignOut={handleSignOut}
          languages={languages}
          crashReportingEnabled={crashReportingEnabled}
          onToggleCrashReporting={handleToggleCrashReporting}
        />

        {showEmergencyPlanNav && (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
            <EmergencyPlanBottomNavigation activeTab="settings" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
} 