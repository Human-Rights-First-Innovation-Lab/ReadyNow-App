import React from "react";
import { Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function HowItWorkPage() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("howitworks", settings.language);

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
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
            fontSize: 20,          },
        }}
      />
      <View className="flex h-full w-full justify-between bg-white">
        <ScrollView className="px-4" style={{ paddingBottom: 80 }}>
          <Text className="pb-12 text-center text-3xl font-bold text-gray-600">
            {t("emergencyPlan")} {t("simplified")}
          </Text>
          <View className="px-4">
            <Text className="mb-2 text-left text-xl font-bold text-gray-600">
              {t("planTitle")}
            </Text>
            <Text className="pb-6 text-left text-lg text-gray-600">
              {t("planDescription")}
            </Text>

            <Text className="mb-2 mt-4 text-left text-xl font-bold text-gray-600">
              {t("actTitle")}
            </Text>
            <Text className="pb-6 text-left text-lg text-gray-600">
              {t("actDescription")}
            </Text>
          </View>
          <View className="my-16">
            <Text
              className="text-center text-lg font-bold text-gray-600 underline"
              onPress={() => router.push("/screens/faq?fromPrivacy=true")}
            >
              {t("learnMore")}
            </Text>
            <Text
              className="mt-2 text-center text-lg font-bold text-gray-600 underline"
              onPress={() => router.push("/screens/faq?fromPrivacy=true")}
            >
              {t("visitFaq")}
            </Text>
          </View>

          <View className="mb-8">
            <Button
              text={t("continue")}
              onPress={() => router.push("/screens/welcome/privacy")}
              style={{ backgroundColor: "#6776cc" }}
            />
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
          <EmergencyPlanBottomNavigation />
      </View>
    </SafeAreaView>
  );
}
