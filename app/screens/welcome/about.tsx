import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { useAppSettings } from "../../utils/app-settings";
import Button from "../../components/Button";
import { usePageTranslation } from "../../translations";

export default function AboutAlertButton() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("about", settings.language);

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
      <View className="flex-1 w-full bg-white p-4">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={true}
        >
          <Text className="pb-4 text-center text-3xl font-bold text-black">
            {t("bePrepared")}
          </Text>
          <Text className="pb-4 text-center text-3xl font-bold text-black">
            {t("getPeaceOfMind")}
          </Text>
          <Text className="px-8 pb-6 text-center text-lg text-black">
            {t("appDescription")}
          </Text>
          <Text className="px-8 pb-6 text-center text-lg text-black">
            {t("contactsInfo")}
          </Text>
        </ScrollView>

        <View className="mb-8">
          <Button
            text={t("continue")}
            onPress={() => router.push("/screens/welcome/howitworks")}
            style={{ backgroundColor: "#6776cc" }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}