import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function BeforeYouStartPage2() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("beforeyoustart2", settings.language);

  const handleContinue = async () => {
    await SecureStore.setItemAsync("hasCompletedOnboarding", "true");
    router.push("/screens/welcome/plan-import-option");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t("title"),
          headerTitleAlign: "center",
          headerStyle: {
            backgroundColor: "#f0f0f2",
          },
          headerTintColor: "#5a69cc",
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 20,
          },
        }}
      />
      <View className="flex h-full w-full justify-between bg-white">
        <ScrollView className="px-4" showsVerticalScrollIndicator={true} style={{ paddingBottom: 80 }}>
          <Text className="pb-4 text-center text-3xl font-bold text-black">
            {t("locateANumber")}{" "}
          </Text>
          <View className="mb-8 mt-6 px-4">
            <Text className="mb-4 text-xl text-black">
              {t("aNumberDescription")}{" "}
            </Text>
            <View className="">
              <Text className="mb-1 text-xl text-black">
                {t("whereToFind")}{" "}
              </Text>
            </View>
          </View>

          <View className="mb-8 px-4">
            <Text className="mb-1 text-xl text-black">{t("whyImportant")}</Text>
          </View>
          <View className="mb-8">
            {/* In the Button component at the bottom */}
            <Button
              text={t("continue")}
              onPress={handleContinue}
              style={{ backgroundColor: "#6776cc" }}
            />
          </View>
        </ScrollView>

          <EmergencyPlanBottomNavigation />
      </View>
    </SafeAreaView>
  );
}
