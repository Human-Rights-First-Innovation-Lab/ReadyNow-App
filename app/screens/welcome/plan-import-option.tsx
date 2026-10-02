import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";
import { useModal } from "../../context/ModalContext";
import { saveEmergencyPlanData } from "../../utils/storage-utils";
import type { MessageData, Contact } from "../../components/MessageSetup";
import { EnhancedTextInput } from "../../components/EnhancedTextInput";
import secureCopyTranslations from "../../translations/secure-copy.json";

interface ParsedMessage {
  topic: string;
  message: string;
  contacts: Contact[];
}

type SupportedHeaderKey = "message" | "messageContent" | "contacts";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildLocalizedHeaderAlternation = (key: SupportedHeaderKey): string => {
  const allLabels = Object.values(secureCopyTranslations)
    .map((translation) => translation[key]?.trim())
    .filter((label): label is string => Boolean(label));

  const uniqueLabels = Array.from(new Set(allLabels)).map(escapeRegex);
  return uniqueLabels.join("|");
};

const MESSAGE_HEADER_REGEX = new RegExp(
  `^\\s*(?:${buildLocalizedHeaderAlternation("message")})\\s+\\d+\\s*:\\s*(.+)$`,
  "iu"
);

const MESSAGE_CONTENT_HEADER_REGEX = new RegExp(
  `^\\s*(?:${buildLocalizedHeaderAlternation("messageContent")})\\s*:\\s*$`,
  "iu"
);

const CONTACTS_HEADER_REGEX = new RegExp(
  `^\\s*(?:${buildLocalizedHeaderAlternation("contacts")})\\s*:\\s*$`,
  "iu"
);

const normalizePhoneNumber = (raw: string): string => {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
};

const parseImportedPlan = (input: string): ParsedMessage[] => {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const parsedMessages: ParsedMessage[] = [];

  let currentTopic = "";
  let currentMessageLines: string[] = [];
  let currentContacts: Contact[] = [];
  let mode: "none" | "message" | "contacts" = "none";

  const finalizeCurrentMessage = () => {
    if (!currentTopic) {
      return;
    }

    const messageText = currentMessageLines.join("\n").trim();
    const validContacts = currentContacts.filter(
      (contact) =>
        contact.name.trim().length > 0 && contact.phoneNumber.trim().length > 0
    );

    // Require at least one non-empty message and one valid contact per entry.
    if (messageText.length > 0 && validContacts.length > 0) {
      parsedMessages.push({
        topic: currentTopic,
        message: messageText,
        contacts: validContacts,
      });
    }

    currentTopic = "";
    currentMessageLines = [];
    currentContacts = [];
    mode = "none";
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const messageHeaderMatch = line.match(MESSAGE_HEADER_REGEX);
    if (messageHeaderMatch) {
      finalizeCurrentMessage();
      currentTopic = messageHeaderMatch[1].trim();
      mode = "none";
      continue;
    }

    if (!currentTopic) {
      continue;
    }

    if (MESSAGE_CONTENT_HEADER_REGEX.test(line)) {
      mode = "message";
      continue;
    }

    if (CONTACTS_HEADER_REGEX.test(line)) {
      mode = "contacts";
      continue;
    }

    if (/^={5,}$/.test(line)) {
      finalizeCurrentMessage();
      continue;
    }

    if (mode === "message") {
      currentMessageLines.push(rawLine);
      continue;
    }

    if (mode === "contacts") {
      const contactMatch = line.match(/^\s*\d+\.\s*(.*?)\s*-\s*(.*?)\s*$/);
      if (!contactMatch) {
        continue;
      }

      const name = contactMatch[1].trim();
      const phoneNumber = normalizePhoneNumber(contactMatch[2]);

      currentContacts.push({
        id: `${Date.now()}-${currentContacts.length}`,
        name,
        phoneNumber,
      });
    }
  }

  finalizeCurrentMessage();
  return parsedMessages;
};

export default function PlanImportOptionPage() {
  const router = useRouter();
  const modal = useModal();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("plan-import-option", settings.language);
  const description = t("description");
  const descriptionBoldPart = t("descriptionBoldPart");
  const boldStartIndex = description.indexOf(descriptionBoldPart);

  const [planInput, setPlanInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputYRef = useRef(0);

  const handleCreateNewPlan = () => {
    router.push("/screens/emergency-plan/legal-support-question");
  };

  const handleImportPlan = async () => {
    const trimmedInput = planInput.trim();
    if (!trimmedInput) {
      modal.showError(t("emptyPlanError"));
      return;
    }

    setIsImporting(true);
    try {
      const parsed = parseImportedPlan(trimmedInput);
      if (parsed.length === 0) {
        modal.showError(t("invalidPlanError"));
        return;
      }

      const messagesToSave: MessageData[] = parsed.map((item, index) => ({
        id: `${Date.now()}-${index}`,
        topic: item.topic,
        message: item.message,
        contacts: item.contacts,
      }));

      await saveEmergencyPlanData(messagesToSave);
      await SecureStore.setItemAsync("hasCompletedOnboarding", "true");
      await SecureStore.setItemAsync("emergency_plan_completed", "true");

      router.push("/screens/emergency-plan/review");
    } catch (error) {
      console.error(
        "Error importing emergency plan:",
        error instanceof Error ? error.message : String(error)
      );
      modal.showError(t("importFailedError"));
    } finally {
      setIsImporting(false);
    }
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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          className="bg-white px-5"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={true}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="pb-4 text-center text-3xl font-bold text-black">
            {t("headline")}
          </Text>

          <Text className="mb-6 text-center text-base text-gray-700">
            {boldStartIndex >= 0 ? (
              <>
                {description.slice(0, boldStartIndex)}
                <Text className="font-bold text-gray-700">{descriptionBoldPart}</Text>
                {description.slice(boldStartIndex + descriptionBoldPart.length)}
              </>
            ) : (
              description
            )}
          </Text>

          <Button
            text={t("createNewPlan")}
            onPress={handleCreateNewPlan}
            style={{ backgroundColor: "#6776cc", marginBottom: 20 }}
          />

          <Text className="mb-4 text-center text-base font-semibold text-gray-500">
            {t("or")}
          </Text>

          <Text className="mb-2 text-lg font-semibold text-black">
            {t("importLabel")}
          </Text>

          <View
            onLayout={(e) => {
              inputYRef.current = e.nativeEvent.layout.y;
            }}
          >
            {planInput.trim().length > 0 ? (
              <View className="mb-4 rounded-xl border border-[#CCCCCC] bg-white">
                <ScrollView
                  style={{ maxHeight: 220, padding: 12 }}
                  nestedScrollEnabled={true}
                >
                  <Text className="text-black">{planInput}</Text>
                </ScrollView>
                <TouchableOpacity
                  className="flex-row items-center justify-center border-t border-[#CCCCCC] py-2"
                  onPress={() => setPlanInput("")}
                >
                  <Feather name="x" size={16} color="#FF3B30" />
                  <Text className="ml-1 font-medium text-[#FF3B30]">
                    {t("clearPlan")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <EnhancedTextInput
                className="mb-4 min-h-[220px] rounded-xl border border-[#CCCCCC] bg-white p-3 text-black"
                multiline
                scrollEnabled={false}
                value={planInput}
                onChangeText={setPlanInput}
                placeholder={t("importPlaceholder")}
                placeholderTextColor="#888"
                textAlignVertical="top"
                returnKeyType="default"
                showDoneButton={true}
                style={{ textAlignVertical: "top" }}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({
                      y: inputYRef.current - 10,
                      animated: true,
                    });
                  }, 300);
                }}
              />
            )}
          </View>

          <Button
            text={isImporting ? t("importingPlan") : t("importPlan")}
            onPress={handleImportPlan}
            style={{ backgroundColor: "#60646c", marginBottom: 24 }}
            disabled={isImporting}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <EmergencyPlanBottomNavigation />
    </SafeAreaView>
  );
}
