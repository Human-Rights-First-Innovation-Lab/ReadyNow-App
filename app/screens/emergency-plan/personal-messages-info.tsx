import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function PersonalMessagesInfo() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("personal-messages-info", settings.language);

  const handleNext = () => {
    router.push("/screens/emergency-plan/personal-message-setup");
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
            fontSize: 20,          },
        }}
      />
      <View className="flex h-full w-full justify-between bg-white">
        <ScrollView className="px-5" style={{ paddingBottom: 80 }}>
          <Text className="mb-5 text-center text-3xl font-bold text-gray-600">
            {t("personalEmergencyMessages")}
          </Text>

          <Text className="mb-4 p-4 text-xl text-gray-700">
            {t("createMessages")}
          </Text>

          <Text className="mb-4 p-4 text-xl text-gray-700">
            {t("additionalMessages").split(t("additionalMessagesBold"))[0]}{" "}
            <Text className="font-bold">{t("additionalMessagesBold")}</Text>
            {t("additionalMessages").split(t("additionalMessagesBold"))[1]}
          </Text>

          <View className="mb-8 mt-8">
            <View className="flex-row items-center self-center">
              <Text className="mr-2 text-xl font-bold">{t("remember")}</Text>
              <Ionicons
                name="alert-circle"
                size={30}
                color="#60646c"
                className="mr-2"
              />
            </View>
            <View className="m-4 rounded border border-gray-200 p-4">
              <Text className="text-lg text-gray-700">{t("messageInfo")}</Text>
            </View>
          </View>
          <View className="mb-8">
            <Button
              text={t("continue")}
              onPress={handleNext}
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
