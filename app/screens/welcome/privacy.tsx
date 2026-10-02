import React from "react";
import { Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
// import * as SecureStore from "expo-secure-store";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import Button from "../../components/Button";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function PrivacyPage() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("privacy", settings.language);

  const handleContinue = () => {
    // Navigate to How It Work Absences Page
    // router.push("/screens/welcome/howitworks");
    // await SecureStore.setItemAsync("hasCompletedOnboarding", "true");

    router.push("/screens/welcome/createaccount");
  };

  const openPrivacyPolicy = async () => {
    await WebBrowser.openBrowserAsync("https://hrfinnovationlab.org/work/readynow/privacypolicy");
  };

  const openTermsOfService = async () => {
    await WebBrowser.openBrowserAsync("https://www.hrfinnovationlab.org/work/readynow/termsofservice");
  };

  return (
    <SafeAreaView className="bg-background">
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
      <View className="flex h-full w-full justify-between bg-white px-4">
        <ScrollView>
          <Text className="pb-4 text-center text-3xl font-bold text-gray-600">
            {t("privacyMatters")}
          </Text>
          <View className="py-8">
            <Text className="px-8 pb-4 text-center text-lg text-gray-600">
              {t("personalInfoSharingConcern")}
            </Text>
            <Text className="px-8 pb-4 text-center text-lg text-gray-600">
              {t("dataConfidentiality")}
            </Text>
          </View>

          <View className="m-4 rounded border border-gray-300 p-4">
            <View className="flex flex-row items-center justify-center space-x-2">
              <Text className="text-center text-lg font-bold text-gray-600">
                {t("securityTip")}
              </Text>
              <MaterialIcons
                name="privacy-tip"
                size={24}
                color="#60646c"
                className="mx-4"
              />
            </View>
            <Text className="text-center text-md p-2 text-gray-600">
              {t("securityTipText")}
            </Text>
          </View>
          <View className="my-4 px-8 space-y-2">
            <Text
              className="text-center text-lg font-bold text-gray-600 underline"
              onPress={() => router.push("/screens/faq?fromPrivacy=true")}
            >
              {t("learnMoreText")}
            </Text>
            <Text
              className="text-center text-lg font-bold text-blue-600 underline"
              onPress={openPrivacyPolicy}
            >
              {t("privacyPolicyLink")}
            </Text>
            <Text
              className="text-center text-lg font-bold text-blue-600 underline"
              onPress={openTermsOfService}
            >
              {t("termsOfServiceLink")}
            </Text>
          </View>
        </ScrollView>
        <View className="mb-8">
          <Button
            text={t("continue")}
            onPress={handleContinue}
            style={{ backgroundColor: "#6776cc" }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
