import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import Button from "../../components/Button";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";
import { setCrashReportingConsent } from "../../utils/crash-reporting";

/**
 * Opt-in prompt for crash reporting, shown once immediately after the user
 * creates an account.
 *
 * Until a choice is made here, Sentry has never been initialized, so no crash
 * reporting client exists and nothing has been sent. The `next` param carries
 * the destination the auth flow would otherwise have gone to, so this screen
 * slots in without changing where anyone ends up.
 */
export default function CrashReportingConsentPage() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("crash-reporting", settings.language);
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const respond = async (granted: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await setCrashReportingConsent(granted);
    } catch (error) {
      // A failure to record the choice must not strand the user mid-signup.
      // Consent stays unset, which means crash reporting stays off and the
      // prompt is shown again next time.
      console.error(
        "Could not save crash reporting choice:",
        error instanceof Error ? error.message : String(error)
      );
    }

    router.replace((next || "main") as never);
  };

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen
        options={{
          title: t("title"),
          headerShown: true,
          gestureEnabled: false,
          headerBackVisible: false,
          headerTitleAlign: "center",
          headerLeft: () => null,
          headerStyle: { backgroundColor: "#f0f0f2" },
          headerTintColor: "#5a69cc",
          headerTitleStyle: { fontWeight: "bold", fontSize: 20 },
        }}
      />
      <View className="flex h-full w-full justify-between bg-white">
        <ScrollView
          className="px-4"
          showsVerticalScrollIndicator={true}
          style={{ paddingBottom: 80 }}
        >
          <Text className="pb-4 text-center text-3xl font-bold text-gray-600">
            {t("heading")}
          </Text>

          <View className="mb-6 px-4">
            <Text className="mb-4 text-xl text-black">{t("intro")}</Text>
          </View>

          <View className="mb-6 px-4">
            <Text className="mb-2 text-xl font-bold text-black">
              {t("whatWeSend")}
            </Text>
            <Text className="mb-1 text-xl text-black">{t("sendItem1")}</Text>
            <Text className="mb-1 text-xl text-black">{t("sendItem2")}</Text>
            <Text className="mb-1 text-xl text-black">{t("sendItem3")}</Text>
          </View>

          <View className="mb-6 px-4">
            <Text className="mb-2 text-xl font-bold text-black">
              {t("whatWeNeverSend")}
            </Text>
            <Text className="mb-1 text-xl text-black">{t("neverItem1")}</Text>
            <Text className="mb-1 text-xl text-black">{t("neverItem2")}</Text>
            <Text className="mb-1 text-xl text-black">{t("neverItem3")}</Text>
            <Text className="mb-1 text-xl text-black">{t("neverItem4")}</Text>
          </View>

          <View className="mb-8 px-4">
            <Text className="text-xl text-black">{t("yourChoice")}</Text>
          </View>

          <View className="mb-4">
            <Button
              text={t("accept")}
              onPress={() => respond(true)}
              style={{ backgroundColor: "#6776cc" }}
            />
          </View>
          <View className="mb-8">
            <Button
              text={t("decline")}
              onPress={() => respond(false)}
              style={{ backgroundColor: "#8a8a8f" }}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
