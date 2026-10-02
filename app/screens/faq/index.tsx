import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import BottomNavigation from "../../components/BottomNavigation";
import { FAQList } from "../../components/FAQList";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function FAQScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const showBottomNav = params.fromPrivacy !== "true";
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("main", settings.language);

  const handleTabChange = (tab: "alert" | "plan" | "faq" | "feedback" | "settings") => {
    if (tab !== "faq") {
      router.push({
        pathname: "main" as any,
        params: { tab },
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
      <Stack.Screen
        options={{
          title: t("faq"),
          headerTitleAlign: "center",
          headerLeft: () => (!showBottomNav ? null : null),
        }}
      />
      <View style={{ flex: 1 }} className="bg-white">
        <FAQList
          contentContainerStyle={{
            padding: 16,
            paddingBottom: showBottomNav ? 80 : 16,
          }}
        />

        {showBottomNav && (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
            <BottomNavigation activeTab="faq" onTabChange={handleTabChange} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
