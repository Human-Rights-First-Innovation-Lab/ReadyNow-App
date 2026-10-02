import React, { useState } from "react";
import {
  Clipboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function EmergencyPlanConfirmation() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [consent, setConsent] = useState(false);
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("confirmation", settings.language);
  // helper to validate basic US phone pattern (10-15 digits)

  // Pre-defined message that will be copied
  const predefinedMessage = t("predefinedMessage");
  const copyToClipboard = () => {
    Clipboard.setString(predefinedMessage);
    setCopied(true);

    // Reset the copied state after 3 seconds
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  const handleContinue = () => {
    router.push("/screens/emergency-plan/secure-copy" as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t("title"),
          headerTitleAlign: "center",
          headerLeft: () => null, // Disable back button
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
          <Text className="mb-5 text-center text-3xl font-bold text-gray-700">
            {t("giveHeadsUp")}
          </Text>
          <Text className="mb-4 text-lg leading-6 text-gray-700">
            {t("letContactsKnow")}
          </Text>
          <Text className="mb-4 text-lg leading-6 text-gray-700">
            {t("alertsSource")}
          </Text>

          <View className="mb-8 rounded-xl border border-gray-400 bg-gray-100 p-4">
            <Text className="text-center text-lg font-bold text-gray-700">
              {t("suggestedMessage")}
            </Text>
            <View className="my-4 overflow-hidden rounded-lg border border-gray-200">
              <TextInput
                className="bg-white p-4 text-base text-gray-500"
                multiline
                editable={false}
                value={predefinedMessage}
                style={{ minHeight: 100, textAlignVertical: "top" }}
              />

              <TouchableOpacity
                className="mt-8 flex-row items-center justify-center rounded bg-[#60646c] p-3"
                onPress={copyToClipboard}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={20}
                  color="white"
                />
                <Text className="ml-2 font-bold text-white">
                  {copied ? t("copied") : t("copyMessage")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text className="mb-4 text-base font-bold leading-6 text-gray-700">
            {t("readyNowWillSend")}
          </Text>
          <Text className="mb-4 text-base font-bold text-gray-600">
            {t("msgDataRates")}
          </Text>

          {/* Consent Checkbox */}
          <TouchableOpacity
            className="mb-6 flex-row items-center"
            onPress={() => setConsent((prev) => !prev)}
          >
            <Ionicons
              name={consent ? "checkbox" : "square-outline"}
              size={24}
              color="#6776cc"
            />
            <Text className="m-4 text-base text-gray-700">
              {t("confirmPermission")}
            </Text>
          </TouchableOpacity>
          {/* Send Invitation Button */}
          <View className="mb-8">
            <Button
              text={t("sendSmsInvitation")}
              onPress={handleContinue}
              disabled={!consent}
              style={{
                backgroundColor: "#6776cc",
                opacity: !consent ? 0.5 : 1,
              }}
            />
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
          <EmergencyPlanBottomNavigation />
      </View>
    </SafeAreaView>
  );
}
