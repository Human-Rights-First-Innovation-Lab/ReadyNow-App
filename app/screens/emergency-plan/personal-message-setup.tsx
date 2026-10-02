import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import type { MessageData } from "../../components/MessageSetup";
import {
  loadEmergencyPlanData,
  saveEmergencyPlanData,
} from "../../utils/storage-utils";
import { getDefaultMessageByTopic } from "../../utils/default-messages";
import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { MessageSetup } from "../../components/MessageSetup";
import { useModal } from "../../context/ModalContext";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function PersonalMessageSetup() {
  const router = useRouter();
  const { showError, showConfirm } = useModal();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("personal-message-setup", settings.language);

  // Define showErrorMessage with useCallback to avoid recreation on render
  const showErrorMessage = useCallback(
    (message: string) => {
      showError(message);
    },
    [showError]
  );

  // Define createDefaultMessage outside useEffect to avoid recreating it on each render
  const createDefaultMessage = useCallback((): MessageData => {
    return {
      id: Date.now().toString(),
      topic: "Personal Emergency",
      message: getDefaultMessageByTopic(
        "Personal Emergency",
        settings.language
      ),
      contacts: [
        {
          id: `${Date.now()}`,
          name: "",
          phoneNumber: "",
        },
      ],
    };
  }, [settings.language]);

  useEffect(() => {
    // Load existing data or initialize with a default message
    const loadData = async () => {
      try {
        const { messages: loadedMessages } = await loadEmergencyPlanData();

        // Filter only personal messages
        const personalMessages = loadedMessages.filter((msg) =>
          msg.topic.includes("Personal Emergency")
        );

        if (personalMessages.length > 0) {
          setMessages(personalMessages);
        } else {
          // Initialize with a default message
          setMessages([createDefaultMessage()]);
        }
      } catch (error) {
        console.error(
          "Error loading emergency plan data:",
          error instanceof Error ? error.message : String(error)
        );
        showErrorMessage(t("errorLoading"));
      }
    };

    void loadData();
    // Using a ref for t to avoid re-running effect when translations change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDefaultMessage, showErrorMessage]);

  const handleUpdateMessage = (updatedMessage: MessageData) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
    );
  };

  const handleDeleteMessage = (id: string) => {
    showConfirm(t("deleteMessage"), t("deleteConfirmation"), () => {
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== id)
      );
    });
  };

  const handleCreateAnotherMessage = () => {
    setMessages((prev) => [...prev, createDefaultMessage()]);
  };

  const hasDuplicateContacts = (contacts: MessageData["contacts"]): boolean => {
    const seenPhoneNumbers = new Set<string>();

    for (const contact of contacts) {
      const normalizedPhone = contact.phoneNumber.replace(/\D/g, "");
      if (!normalizedPhone) {
        continue;
      }

      if (seenPhoneNumbers.has(normalizedPhone)) {
        return true;
      }

      seenPhoneNumbers.add(normalizedPhone);
    }

    return false;
  };

  const handleSaveAndContinue = async () => {
    // Validate messages
    for (const msg of messages) {
      if (!msg.message.trim()) {
        showError(t("errorEmptyMessage"));
        return;
      }

      for (const contact of msg.contacts) {
        if (!contact.name.trim() || !contact.phoneNumber.trim()) {
          showError(t("errorEmptyContact"));
          return;
        }
      }

      if (hasDuplicateContacts(msg.contacts)) {
        showError(t("errorDuplicateContact"));
        return;
      }
    }

    try {
      // Load all existing messages
      const { messages: existingMessages } = await loadEmergencyPlanData();

      // Filter out any existing personal messages
      const nonPersonalMessages = existingMessages.filter(
        (msg) => !msg.topic.includes("Personal Emergency")
      );

      // Combine with new personal messages
      const allMessages = [...nonPersonalMessages, ...messages];

      // Save all messages
      await saveEmergencyPlanData(allMessages);

      // Navigate to next screen
      router.push("/screens/emergency-plan/additional-topics");
    } catch (error) {
      console.error(
        "Error saving emergency plan data:",
        error instanceof Error ? error.message : String(error)
      );
      showError(t("errorSaving"));
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
      <View className="flex h-full w-full justify-between bg-white">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            className="px-5"
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            style={{ paddingBottom: 80 }}
          >
            <Text className="mb-4 text-center text-3xl font-bold text-black">
              {t("personalSafetyMessages")}
            </Text>
            <View className="p-4">
              <Text className="my-6 text-left text-xl leading-6 text-gray-700">
                {
                  t("createPersonalSafetyMessages").split(
                    t("createPersonalSafetyMessagesBold")
                  )[0]
                }{" "}
                <Text className="font-bold">
                  {t("createPersonalSafetyMessagesBold")}
                </Text>
                {
                  t("createPersonalSafetyMessages").split(
                    t("createPersonalSafetyMessagesBold")
                  )[1]
                }
              </Text>
            </View>

            <View className="p-4">
              <Text className="text-xl">{t("recommendIncluding")}</Text>
              <Text className="text-lg">{t("lawyerInfo")}</Text>
              <Text className="text-lg">{t("aNumberInfo")}</Text>
              <Text className="text-lg">{t("healthInfo")}</Text>
              <Text className="text-lg">{t("documentsInfo")}</Text>
            </View>
            <View className="p-4">
              <Text className="text-xl font-bold">{t("editSample")}</Text>
            </View>
            <View className="p-4">
              <Text className="text-xl font-bold">{t("onlySentIf")}</Text>
            </View>

            {messages.map((message) => (
              <MessageSetup
                key={message.id}
                messageData={message}
                onUpdate={handleUpdateMessage}
                onDelete={() => handleDeleteMessage(message.id)}
                showDeleteButton={messages.length > 1}
              />
            ))}
            <Button
              text={t("addAnotherMessage")}
              onPress={handleCreateAnotherMessage}
              style={{ backgroundColor: "#60646c" }}
              className="mb-4"
            />
            <View className="py-4 border-t border-gray-200 bg-white ">
              <Button
                text={t("skip")}
                onPress={() =>
                  router.push("/screens/emergency-plan/additional-topics")
                }
                style={{ backgroundColor: "#edf2fe" }}
                className="mb-4"
                textStyle={{
                  color: "#6776cc",
                }}
              />
              <Button
                text={t("saveAndContinue")}
                onPress={handleSaveAndContinue}
                style={{ backgroundColor: "#6776cc" }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Emergency Plan Bottom Navigation */}
        <EmergencyPlanBottomNavigation />
      </View>
    </SafeAreaView>
  );
}
