import React, { useState, useMemo, useRef } from "react";
import {
  InteractionManager,
  Text,
  View,
  Image,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import type { AppLanguage } from "../../utils/app-settings";
import { logAppSettings, useAppSettings } from "../../utils/app-settings";
import { clearUserData } from "../../utils/storage-utils";
import Button from "../../components/Button";
import { NativePicker } from "../../components/NativePicker";
import { usePageTranslation } from "../../translations";

export default function WelcomePage() {
  const router = useRouter();
  const { settings, updateSetting } = useAppSettings();
  const [selectedLanguage, setSelectedLanguage] = useState(settings.language);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const { t } = usePageTranslation("welcome", selectedLanguage);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isChangingLanguageRef = useRef(false);

  // Memoize languages array to prevent unnecessary re-renders
  const languages = useMemo(() => [
    { label: t("englishLabel"), value: "en" },
    { label: t("spanishLabel"), value: "es" },
    { label: t("koreanLabel"), value: "kr" },
    { label: t("frenchLabel"), value: "fr" },
    { label: t("creoleLabel"), value: "ht" },
    { label: t("chineseLabel"), value: "zh" },
    { label: t("arabicLabel"), value: "ar" },
    { label: t("dariLabel"), value: "dr" },
    { label: t("pashtoLabel"), value: "ps" },
  ], [t]);

  const handleLanguageChange = async (value: string) => {
    // Prevent rapid language changes and only update if value actually changed
    if (isChangingLanguageRef.current || value === selectedLanguage) {
      return;
    }

    isChangingLanguageRef.current = true;
    setIsChangingLanguage(true);
    
    try {
      await clearUserData();
      setSelectedLanguage(value as AppLanguage);

      // Update app settings with the new language
      await updateSetting("language", value as AppLanguage);

      // Log app settings to verify they were saved
      await logAppSettings();
    } finally {
      isChangingLanguageRef.current = false;
      setIsChangingLanguage(false);
    }
  };

  const handleContinue = () => {
    if (isChangingLanguageRef.current || isChangingLanguage) {
      return;
    }
    // Navigate to the next screen
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        router.push("/screens/welcome/about");
      }, 50);
    });
  };

  // Calculate logo sizes based on screen height
  const logoHeight = height * 0.15;
  const hrfLogoHeight = height * 0.1;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: t("readyNow"),
          headerShown: false, // Hide the entire header
        }}
      />
      <View className="flex-1 w-full bg-white p-4">
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View className="w-full">
            <View className="flex items-center justify-center">
              <Image
                source={require("../../../assets/images/readynow-updated-logo.png")}
                style={{ height: logoHeight, width: "100%" }}
                resizeMode="contain"
              />
              <Image
                source={require("../../../assets/images/hrf-logo.png")}
                style={{
                  height: hrfLogoHeight,
                  width: "100%",
                  marginBottom: height * 0.02,
                }}
                resizeMode="contain"
              />
            </View>
            <Text className="mt-2 text-center text-lg font-bold text-black">
              {t("selectLanguage")}
            </Text>

            <View className="my-4">
              <NativePicker
                selectedValue={selectedLanguage}
                onValueChange={handleLanguageChange}
                items={languages}
                placeholder={t("languagePlaceholder")}
              />
            </View>
          </View>
        </ScrollView>
        <View className="pt-2" style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}>
          <Button
            text={isChangingLanguage ? t("continue") : t("continue")}
            onPress={handleContinue}
            style={{ backgroundColor: "#6776cc", minHeight: 48 }}
            disabled={isChangingLanguage}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
