import React, { useMemo } from "react";
import { Text, View, ScrollView } from "react-native";

import Button from "./Button";
import { CustomPicker } from "./Picker";
import type { AppLanguage } from "../utils/app-settings";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

interface SettingsTabProps {
  selectedLanguage: AppLanguage;
  onLanguageChange: (value: string) => void;
  onSignOut: () => void;
  onTryDemo?: () => void;
  onEnablePushNotifications?: () => void;
  showPushNotificationsButton?: boolean;
  languages: { label: string; value: string }[];
  crashReportingEnabled: boolean;
  onToggleCrashReporting: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  selectedLanguage,
  onLanguageChange,
  onSignOut,
  onTryDemo,
  onEnablePushNotifications,
  showPushNotificationsButton = false,
  languages,
  crashReportingEnabled,
  onToggleCrashReporting,
}) => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("main", settings.language);
  const { t: tCrash } = usePageTranslation("crash-reporting", settings.language);

  // Memoize translations to avoid unnecessary re-renders
  const translations = useMemo(() => {
    return {
      title: t("settingsTitle"),
      languageSection: t("languageSection"),
      selectLanguage: t("selectLanguage"),
      selectLanguagePlaceholder: t("selectLanguagePlaceholder"),
      accountSection: t("accountSection"),
      signOut: t("signOut"),
      tryDemo: t("tryDemo"),
      tryDemoSection: t("tryDemoSection"),
      notificationSection: t("notificationSection"),
      enablePushNotifications: t("enablePushNotifications"),
      pushNotificationDescription: t("pushNotificationDescription"),
    };
  }, [settings.language, t]);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
      <Text className="mb-4 text-center text-2xl font-bold text-black">
        {translations.title}
      </Text>

      <View className="mb-8">
        <Text className="mb-2 text-lg font-bold text-black">
          {translations.languageSection}
        </Text>
        <Text className="mb-4 text-base text-gray-700">
          {translations.selectLanguage}
        </Text>
        <CustomPicker
          selectedValue={selectedLanguage}
          onValueChange={onLanguageChange}
          items={languages}
          placeholder={translations.selectLanguagePlaceholder}
        />
      </View>

      {showPushNotificationsButton && onEnablePushNotifications && (
        <View className="mb-8">
          <Text className="mb-2 text-lg font-bold text-black">
            {translations.notificationSection}
          </Text>
          <Text className="mb-4 text-base text-gray-700">
            {translations.pushNotificationDescription}
          </Text>
          <Button
            text={translations.enablePushNotifications}
            onPress={onEnablePushNotifications}
            style={{ backgroundColor: "#34C759" }}
          />
        </View>
      )}

      <View className="mb-8">
        <Text className="mb-2 text-lg font-bold text-black">
          {tCrash("settingsSection")}
        </Text>
        <Text className="mb-4 text-base text-gray-700">
          {crashReportingEnabled ? tCrash("settingsOn") : tCrash("settingsOff")}
        </Text>
        <Button
          text={crashReportingEnabled ? tCrash("turnOff") : tCrash("turnOn")}
          onPress={onToggleCrashReporting}
          style={{ backgroundColor: crashReportingEnabled ? "#8a8a8f" : "#6776cc" }}
        />
      </View>

      <View className="mb-8">
        <Text className="mb-2 text-lg font-bold text-black">
          {translations.accountSection}
        </Text>
     
        <Button
          text={translations.signOut}
          onPress={onSignOut}
          style={{ backgroundColor: "#6776cc" }}
        />
        {onTryDemo && (
          <>
        <Text className="mb-2 mt-8 text-lg font-bold text-black">
          {translations.tryDemoSection}
        </Text>
          <Button
            text={translations.tryDemo}
            onPress={onTryDemo}
            style={{ backgroundColor: "#34C759", marginBottom: 12 }}
          />
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default SettingsTab;
