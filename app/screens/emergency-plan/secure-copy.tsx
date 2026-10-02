import React, { useState, useEffect } from "react";
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
import * as Sentry from "@sentry/react-native";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";
import { loadEmergencyPlanData } from "../../utils/storage-utils";
import type { MessageData } from "../../components/MessageSetup";

export default function SecureCopy() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [planText, setPlanText] = useState("");
  const [loading, setLoading] = useState(true);
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("secure-copy", settings.language);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const { messages } = await loadEmergencyPlanData();
        const formattedPlan = formatEmergencyPlan(messages);
        setPlanText(formattedPlan);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            screen: "SecureCopy",
            action: "load_emergency_plan",
          },
          level: "error",
        });
        setPlanText(t("errorLoadingPlan"));
      } finally {
        setLoading(false);
      }
    };

    void loadPlan();
  }, [t]);

  const formatEmergencyPlan = (messages: MessageData[]): string => {
    if (!messages || messages.length === 0) {
      return t("noPlanData");
    }

    let formatted = t("planIntroMessage") + "\n\n";

    messages.forEach((message, index) => {
      formatted += `${t("message")} ${index + 1}: ${message.topic}\n`;
      formatted += "-".repeat(40) + "\n";
      formatted += `${t("messageContent")}:\n${message.message}\n\n`;

      if (message.contacts && message.contacts.length > 0) {
        formatted += `${t("contacts")}:\n`;
        message.contacts.forEach((contact, contactIndex) => {
          formatted += `  ${contactIndex + 1}. ${contact.name} - ${contact.phoneNumber}\n`;
        });
        formatted += "\n";
      } else {
        formatted += `${t("noContacts")}\n\n`;
      }

      formatted += "\n";
    });

    formatted += "=".repeat(40) + "\n";
    formatted += `${t("generatedBy")} ReadyNow\n`;
    formatted += t("keepSafe");

    return formatted;
  };

  const copyToClipboard = () => {
    Clipboard.setString(planText);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  const handleContinue = () => {
    router.replace("/main?planJustCompleted=true");
  };

  const handleSkip = () => {
    router.replace("/main?planJustCompleted=true");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t("header"),
          headerTitleAlign: "center",
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
        <ScrollView className="px-5" style={{ paddingBottom: 80 }}>
          <Text className="mb-5 text-center text-3xl font-bold text-gray-700">
            {t("title")}
          </Text>

          <Text className="mb-4 text-lg leading-6 text-gray-700">
            {t("recommendation")}
          </Text>

          <Text className="mb-2 text-lg font-semibold text-gray-800">
            {t("instructionsTitle")}
          </Text>
          
          <View className="mb-6 ml-2">
            <View className="mb-2 flex-row">
              <Text className="mr-2 text-base text-gray-700">1.</Text>
              <Text className="flex-1 text-base text-gray-700">{t("step1")}</Text>
            </View>
            <View className="mb-2 flex-row">
              <Text className="mr-2 text-base text-gray-700">2.</Text>
              <Text className="flex-1 text-base text-gray-700">{t("step2")}</Text>
            </View>
            <View className="mb-2 flex-row">
              <Text className="mr-2 text-base text-gray-700">3.</Text>
              <Text className="flex-1 text-base text-gray-700">{t("step3")}</Text>
            </View>
            <View className="mb-2 flex-row">
              <Text className="mr-2 text-base text-gray-700">4.</Text>
              <Text className="flex-1 text-base text-gray-700">{t("step4")}</Text>
            </View>
          </View>

          <View className="mb-8 rounded-xl border border-gray-400 bg-gray-100 p-4">
            <Text className="mb-2 text-center text-lg font-bold text-gray-700">
              {t("yourPlan")}
            </Text>

            <View className="my-4 overflow-hidden rounded-lg border border-gray-200">
              <ScrollView
                className="bg-white p-4"
                style={{
                  minHeight: 300,
                  maxHeight: 400,
                }}
                nestedScrollEnabled={true}
              >
                <Text className="text-sm text-gray-700">
                  {loading ? t("loading") : planText}
                </Text>
              </ScrollView>

              <TouchableOpacity
                className="mt-4 flex-row items-center justify-center rounded bg-[#6776cc] p-3"
                onPress={copyToClipboard}
                disabled={loading}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={20}
                  color="white"
                />
                <Text className="ml-2 font-bold text-white">
                  {copied ? t("copied") : t("copyPlan")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text className="mb-6 text-base text-gray-600">
            {t("shareInstructions")}
          </Text>

          {/* Action Buttons */}

          <View className="mb-4">
            <Button
              text={t("skip")}
              onPress={handleSkip}
              style={{
                backgroundColor: "#eff2fc",
              }}
              textStyle={{ color: "#6776cc" }}
            />
          </View>
          <View className="mb-4">
            <Button
              text={t("continue")}
              onPress={handleContinue}
              style={{
                backgroundColor: "#6776cc",
              }}
            />
          </View>
        </ScrollView>

        <EmergencyPlanBottomNavigation />
      </View>
    </SafeAreaView>
  );
}

