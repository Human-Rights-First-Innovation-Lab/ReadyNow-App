import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import EmergencyPlanBottomNavigation from "../components/EmergencyPlanBottomNavigation";
import FeedbackTab from "../components/FeedbackTab";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

export default function FeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const showEmergencyPlanNav = params.fromEmergencyPlan === "true";
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("main", settings.language);

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
      <Stack.Screen
        options={{
          title: t("feedback"),
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
        <View style={{ flex: 1, paddingBottom: showEmergencyPlanNav ? 80 : 0 }}>
          <FeedbackTab />
        </View>

        {showEmergencyPlanNav && (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
            <EmergencyPlanBottomNavigation activeTab="feedback" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
} 