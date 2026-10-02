import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function BeforeYouStartPage1() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("beforeyoustart1", settings.language);

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen
        options={{
          title: t("title"),
          headerShown: true,
          gestureEnabled: false,
          headerBackVisible: true,
          headerTitleAlign: "center",

          // headerBackVisible: false,
          headerLeft: () => null,
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
        <ScrollView
          className="px-4"
          showsVerticalScrollIndicator={true}
          style={{ paddingBottom: 80 }}
        >
          <Text className="pb-4 text-center text-3xl font-bold text-gray-600">
            {t("assembleKeyDocuments")}
          </Text>

          <View className="mb-8 mt-6 px-4">
            <Text className="mb-4 text-xl text-black">
              {t("securityReason")}{" "}
              <Text className="text-xl font-bold">{t("cannotUpload")}</Text>
            </Text>
            <Text className="mb-4 text-xl text-black">
              {t("suggestion")}{" "}
              <Text className="text-xl font-bold">{t("gatherDocuments")}</Text>{" "}
              {t("location")}
            </Text>
            <View className="mt-4">
              <Text className="mb-4 text-xl text-black">{t("consider")}</Text>
              <Text className="mb-1 text-xl text-black">
                {t("identityDocs")}
              </Text>
              <Text className="mb-1 text-xl text-black">
                {t("immigrationDocs")}
              </Text>
              <Text className="mb-1 text-xl text-black">
                {t("lengthOfStayDocs")}
              </Text>
            </View>
          </View>

          <View className="mb-8 px-4">
            <Text className="mb-1 text-xl text-black">
              {t("accessImportant")}{" "}
              <Text className="text-xl font-bold">{t("includeAccess")} </Text>{" "}
              {t("onReadyNow")}
            </Text>
          </View>
          <View className="mb-8">
            {/* In the Button component at the bottom */}
            <Button
              text={t("continue")}
              onPress={() => router.push("/screens/welcome/beforeyoustart2")}
              style={{ backgroundColor: "#6776cc" }}
            />
          </View>
        </ScrollView>
        <EmergencyPlanBottomNavigation />

        {/* Bottom Navigation */}
      </View>
    </SafeAreaView>
  );
}
