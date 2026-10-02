import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

type EmergencyPlanTab = "settings" | "feedback";

interface EmergencyPlanBottomNavigationProps {
  activeTab?: EmergencyPlanTab | null;
}

export default function EmergencyPlanBottomNavigation({
  activeTab = null,
}: EmergencyPlanBottomNavigationProps) {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("main", settings.language);

  // Use memoized translations to avoid re-renders and infinite loops
  const translations = useMemo(() => {
    return {
      feedback: t("navFeedback"),
      settings: t("navSettings"),
    };
  }, [settings.language]);

  const handleTabPress = (tab: EmergencyPlanTab) => {
    if (tab === "feedback") {
      router.push({
        pathname: "/screens/feedback" as any,
        params: { fromEmergencyPlan: "true" },
      });
    } else if (tab === "settings") {
      router.push({
        pathname: "/screens/settings" as any,
        params: { fromEmergencyPlan: "true" },
      });
    }
  };

  return (
    <View className="flex-row border-t border-gray-200 bg-white">
      <TouchableOpacity
        className={`flex-1 items-center py-3 ${
          activeTab === "feedback" ? "bg-gray-100" : ""
        }`}
        onPress={() => handleTabPress("feedback")}
      >
        <Ionicons
          name="chatbubble-outline"
          size={24}
          color={activeTab === "feedback" ? "#5a69cc" : "#777"}
        />
        <Text
          className={`mt-1 text-xs ${
            activeTab === "feedback" ? "font-bold text-[#5a69cc]" : "text-gray-600"
          }`}
        >
          {translations.feedback}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`flex-1 items-center py-3 ${
          activeTab === "settings" ? "bg-gray-100" : ""
        }`}
        onPress={() => handleTabPress("settings")}
      >
        <Ionicons
          name="settings"
          size={24}
          color={activeTab === "settings" ? "#5a69cc" : "#777"}
        />
        <Text
          className={`mt-1 text-xs ${
            activeTab === "settings"
              ? "font-bold text-[#5a69cc]"
              : "text-gray-600"
          }`}
        >
          {translations.settings}
        </Text>
      </TouchableOpacity>
    </View>
  );
} 