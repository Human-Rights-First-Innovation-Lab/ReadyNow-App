import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

type Tab = "alert" | "plan" | "faq" | "feedback" | "settings";

interface BottomNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNavigation({
  activeTab,
  onTabChange,
}: BottomNavigationProps) {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("main", settings.language);

  // Use memoized translations to avoid re-renders and infinite loops
  const translations = useMemo(() => {
    return {
      alert: t("navAlert"),
      plan: t("navPlan"),
      faq: t("navFaq"),
      feedback: t("navFeedback"),
      settings: t("navSettings"),
    };
  }, [settings.language]);

  return (
    <View className="flex-row border-t border-gray-200 bg-white">
      <TouchableOpacity
        className={`flex-1 items-center py-3 ${
          activeTab === "alert" ? "bg-gray-100" : ""
        }`}
        onPress={() => onTabChange("alert")}
      >
        <MaterialIcons
          name="crisis-alert"
          size={24}
          color={activeTab === "alert" ? "#5a69cc" : "#777"}
        />
        <Text
          className={`mt-1 text-xs ${
            activeTab === "alert" ? "font-bold text-[#5a69cc]" : "text-gray-600"
          }`}
        >
          {translations.alert}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`flex-1 items-center py-3 ${
          activeTab === "plan" ? "bg-gray-100" : ""
        }`}
        onPress={() => onTabChange("plan")}
      >
        <Ionicons
          name="document-text"
          size={24}
          color={activeTab === "plan" ? "#5a69cc" : "#777"}
        />
        <Text
          className={`mt-1 text-xs ${
            activeTab === "plan" ? "font-bold text-[#5a69cc]" : "text-gray-600"
          }`}
        >
          {translations.plan}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`flex-1 items-center py-3 ${
          activeTab === "faq" ? "bg-gray-100" : ""
        }`}
        onPress={() => onTabChange("faq")}
      >
        <Ionicons
          name="help-circle"
          size={24}
          color={activeTab === "faq" ? "#5a69cc" : "#777"}
        />
        <Text
          className={`mt-1 text-xs ${
            activeTab === "faq" ? "font-bold text-[#5a69cc]" : "text-gray-600"
          }`}
        >
          {translations.faq}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`flex-1 items-center py-3 ${
          activeTab === "feedback" ? "bg-gray-100" : ""
        }`}
        onPress={() => onTabChange("feedback")}
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
        onPress={() => onTabChange("settings")}
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
