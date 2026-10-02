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

export default function LegalSupportSetup() {
  const router = useRouter();
  const { showConfirm, showError } = useModal();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("legal-support-setup", settings.language);

  const createDefaultMessage = useCallback((): MessageData => ({
    id: Date.now().toString(),
    topic: "Legal Support",
    message: getDefaultMessageByTopic("Legal Support", settings.language),
    contacts: [
      {
        id: Date.now().toString() + "-1",
        name: "",
        phoneNumber: "",
      },
    ],
  }), [settings.language]);

  useEffect(() => {
    // Load existing data or initialize with a default message
    const loadData = async () => {
      try {
        const { messages: loadedMessages } = await loadEmergencyPlanData();
        // Filter only legal support messages
        const legalMessages = loadedMessages.filter((msg) =>
          msg.topic.includes("Legal Support")
        );

        if (legalMessages.length > 0) {
          setMessages(legalMessages);
        } else {
          // Initialize with a default message if no legal messages exist
          setMessages([createDefaultMessage()]);
        }
      } catch (error) {
        console.error(
          "Error loading emergency plan data:",
          error instanceof Error ? error.message : String(error)
        );
        // Initialize with a default message on error
        setMessages([createDefaultMessage()]);
      }
    };

    void loadData();
  }, [createDefaultMessage]);

  const handleUpdateMessage = (updatedMessage: MessageData) => {
    const messageWithStandardTopic = {
      ...updatedMessage,
      topic: "Legal Support",
    };

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === updatedMessage.id ? messageWithStandardTopic : msg
      )
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
    const newMessage = {
      ...createDefaultMessage(),
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  const handleSaveAndContinue = async () => {
    try {
      // Load all existing messages
      const { messages: existingMessages } = await loadEmergencyPlanData();

      // Filter out any existing legal support messages (including translated ones)
      const nonLegalMessages = existingMessages.filter(
        (msg) =>
          !msg.topic.includes("Legal Support") &&
          !msg.topic.includes(t("legalSupport"))
      );

      // Combine with new legal support messages
      const allMessages = [...nonLegalMessages, ...messages];

      // Save all messages
      await saveEmergencyPlanData(allMessages);

      // Navigate to next screen (skip personal-messages-info)
      router.push("/screens/emergency-plan/personal-message-setup");
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
      <View className="flex-1 bg-white">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            className="px-5 py-5"
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 80 }}
          >
            <Text className="mb-4 text-center text-2xl font-bold text-black">
              {t("legalSupport")}
            </Text>
            <View className="p-4">
              <Text className="text-left text-xl leading-6 text-gray-700">
                {t("createMessage")}{" "}
                <Text className="font-bold">{t("legalSupport")}.</Text>{" "}
                {t("detainedInfo")}
              </Text>
            </View>

            <View className="p-4">
              <Text className="text-xl">{t("recommendIncluding")}</Text>
              <Text className="text-lg">• {t("legalName")}</Text>
              <Text className="text-lg">• {t("emergencyContact")}</Text>
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
              text={t("addDifferentMessage")}
              onPress={handleCreateAnotherMessage}
              style={{ backgroundColor: "#60646c" }}
              className="mb-4 rounded-3xl"
            />
            <View className="border-t border-gray-200 bg-white py-4">
              <Button
                text={t("skip")}
                onPress={() =>
                  router.push("/screens/emergency-plan/personal-message-setup")
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

        <EmergencyPlanBottomNavigation />
      </View>
    </SafeAreaView>
  );
}
