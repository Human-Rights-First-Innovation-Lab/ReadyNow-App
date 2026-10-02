import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import type { MessageData } from "../../components/MessageSetup";
import {
  loadEmergencyPlanData,
  migrateToNewFormat,
  saveEmergencyPlanData,
} from "../../utils/storage-utils";
import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { MessageSetup } from "../../components/MessageSetup";
import {
  LegalSupportForm,
  LegalSupportData,
} from "../../components/LegalSupportForm";
import { CustomModal } from "../../components/CustomModal";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

// Define the raw topic IDs (matching topic-message-setup.tsx)
const TOPIC_IDS = {
  CHILD_CARE: "Child / Family Care",
  ELDERLY_CARE: "Elderly Dependent Care",
  PET_CARE: "Pet Care",
  WORK_ABSENCES: "Work Absences",
  OTHER: "Other",
};

export default function ReviewEmergencyPlan() {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [legalSupportData, setLegalSupportData] =
    useState<LegalSupportData | null>(null);
  const [currentLegalSupportData, setCurrentLegalSupportData] =
    useState<LegalSupportData | null>(null);
  const { settings } = useAppSettings();

  // Get translations
  const { t: additionalTopicsT } = usePageTranslation(
    "additional-topics",
    settings.language
  );
  const { t: personalT } = usePageTranslation(
    "personal-message-setup",
    settings.language
  );
  const { t: emergencyPlanT } = usePageTranslation(
    "emergency-plan-intro",
    settings.language
  );
  const { t } = usePageTranslation("review", settings.language);

  // State for error modal
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState("");
  const [errorModalMessage, setErrorModalMessage] = useState("");

  // State for delete confirmation modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(
    null
  );

  // State for plan saved confirmation modal
  const [planSavedModalVisible, setPlanSavedModalVisible] = useState(false);

  // Method to show the error modal
  const showErrorModal = useCallback((title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  }, []);

  // Get translated topic name for display
  const getTopicDisplayName = (topicId: string) => {
    // Normalize legal support topics from different languages
    if (
      topicId.includes("법적지원") || // Korean
      topicId.includes("Apoyo Legal") || // Spanish
      topicId.toLowerCase().includes("legal")
    ) {
      return emergencyPlanT("legalSupport");
    }

    // For other topic types
    switch (topicId) {
      case TOPIC_IDS.CHILD_CARE:
        return additionalTopicsT("childCare");
      case TOPIC_IDS.ELDERLY_CARE:
        return additionalTopicsT("elderlyCare");
      case TOPIC_IDS.PET_CARE:
        return additionalTopicsT("petCare");
      case TOPIC_IDS.WORK_ABSENCES:
        return additionalTopicsT("workAbsences");
      case "personalMessage":
        return personalT("personalSafetyMessages");
      default:
        return topicId; // Fallback to the original string if not matched
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // First, migrate any existing data to the new format
        await migrateToNewFormat();

        // Then load the data
        const { messages: loadedMessages } = await loadEmergencyPlanData();

        setMessages(loadedMessages || []);

        // Load legal support data
        const legalSupportDataStr = await SecureStore.getItemAsync(
          "additionalLegalHelp"
        );
        if (legalSupportDataStr) {
          try {
            const parsedData = JSON.parse(
              legalSupportDataStr
            ) as LegalSupportData;
            setLegalSupportData(parsedData);
            setCurrentLegalSupportData(parsedData);
          } catch (parseError) {
            console.error(
              "[Review] Error parsing legal support data:",
              parseError
            );
            setLoadError("Failed to parse legal support data");
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "[Review] Error loading emergency plan data:",
          errorMessage
        );
        setLoadError(errorMessage);
        showErrorModal(t("errorTitle"), t("errorLoading"));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [showErrorModal]);

  const handleUpdateMessage = async (updatedMessage: MessageData) => {
    try {
      const updatedMessages = messages.map((msg) =>
        msg.id === updatedMessage.id ? updatedMessage : msg
      );

      setMessages(updatedMessages);

      // Save using the utility function
      await saveEmergencyPlanData(updatedMessages);
    } catch (error) {
      showErrorModal(t("errorTitle"), t("errorUpdating"));
    }
  };

  const handleDeleteMessage = (id: string) => {
    // Set the message to delete and show the confirmation modal
    setMessageToDeleteId(id);
    setDeleteModalVisible(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDeleteId) return;

    try {
      const updatedMessages = messages.filter(
        (msg) => msg.id !== messageToDeleteId
      );
      setMessages(updatedMessages);

      // Save using the utility function
      await saveEmergencyPlanData(updatedMessages);

      // Close the delete modal
      setDeleteModalVisible(false);
      setMessageToDeleteId(null);
    } catch (error) {
      console.error(
        "[Review] Error deleting message:",
        error instanceof Error ? error.message : String(error)
      );
      setDeleteModalVisible(false);
      showErrorModal(t("errorTitle"), t("errorDeleting"));
    }
  };

  const handleLegalSupportChange = (formData: LegalSupportData) => {
    setCurrentLegalSupportData(formData);
  };

  const handleCancelLegalSupport = async () => {
    try {
      // Clear both saved and draft legal support data
      await SecureStore.deleteItemAsync("additionalLegalHelp");
      await SecureStore.deleteItemAsync("additionalLegalHelp_draft");
      
      // Update local state to remove the form
      setLegalSupportData(null);
      setCurrentLegalSupportData(null);
    } catch (error) {
      console.error("Error cancelling legal support:", error);
      showErrorModal(t("errorTitle"), t("errorCancellingLegal" as any));
    }
  };

  const handleFinish = async () => {
    try {
      // Save legal support data if it has been modified
      if (currentLegalSupportData) {
        await SecureStore.setItemAsync(
          "additionalLegalHelp",
          JSON.stringify(currentLegalSupportData)
        );
      }

      // Mark the emergency plan as completed
      await SecureStore.setItemAsync("emergency_plan_completed", "true");

      // Show the confirmation modal instead of navigating immediately
      setPlanSavedModalVisible(true);
    } catch (error) {
      console.error(
        "[Review] Error completing emergency plan:",
        error instanceof Error ? error.message : String(error)
      );
      showErrorModal(t("errorTitle"), t("errorSaving"));
    }
  };

  const handlePlanSavedModalClose = () => {
    setPlanSavedModalVisible(false);
    // Navigate to the confirmation page after closing the modal
    router.push("/screens/emergency-plan/confirmation");
  };

  // Group messages by topic
  const groupedMessages: Record<string, MessageData[]> = {};
  messages.forEach((message) => {
    // Skip messages with no topic (shouldn't happen but just in case)
    if (!message.topic) return;

    // Normalize the topic key - use the standard ID if possible
    // This ensures topics are grouped consistently across languages
    let topicKey = message.topic;

    // Look up the message topic in our known IDs (reverse lookup)
    Object.entries(TOPIC_IDS).forEach(([_, id]) => {
      if (message.topic === id) {
        topicKey = id;
      }
    });

    // Initialize the array if needed
    if (!groupedMessages[topicKey]) {
      groupedMessages[topicKey] = [];
    }

    // Add the message to the array
    const topicMessages = groupedMessages[topicKey];
    if (topicMessages) {
      topicMessages.push(message);
    }
  });

  // Check if we have any data to save
  const hasData = messages.length > 0 || legalSupportData !== null;
  const hasMessages = messages.length > 0;

  // Debug information to show on screen when no messages are found
  const debugInfo = loadError
    ? `Error: ${loadError}`
    : hasMessages
    ? `Found ${messages.length} messages`
    : "No messages found. Please check if you've saved messages in previous screens.";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t("title"),
          headerTitleAlign: "center",
        }}
      />
      <View className="flex h-full w-full justify-between bg-white">
        <ScrollView className="px-5" style={{ paddingBottom: 80 }}>
          <Text className="mb-4 text-center text-3xl font-bold text-black">
            {t("reviewYourPlan")}
          </Text>
          <Text className="text-xl mt-4 leading-6 text-gray-700">
            {t("carefullyReview")
              .split(t("carefullyReviewBold"))
              .map((part, i) => {
                // If this is the first part (before bold)
                if (i === 0) {
                  return (
                    <React.Fragment key={i}>
                      {part}
                      <Text className="font-bold">
                        {t("carefullyReviewBold")}
                      </Text>
                    </React.Fragment>
                  );
                }
                // If this is the second part (after bold)
                return part;
              })}
          </Text>

          <Text className="text-xl my-8 leading-6 text-gray-700">
            {t("editLater")}
          </Text>

          {loading ? (
            <View className="items-center p-5">
              <Text>{t("loading")}</Text>
            </View>
          ) : messages.length === 0 && !legalSupportData ? (
            <View className="items-center justify-center rounded-lg bg-gray-100 p-8 mb-8">
              <Text className="text-center text-xl text-gray-600">
                {t("noMessagesYet")}
              </Text>
              <Text className="mt-2 text-xs text-gray-500">{debugInfo}</Text>
              <Button
                text={t("createMessages")}
                onPress={() => router.push("/screens/emergency-plan")}
                style={{ backgroundColor: "#6776cc" }}
                className="mt-4"
              />
            </View>
          ) : (
            <>
              {/* Display Messages */}
              {messages.length > 0 ? (
                Object.entries(groupedMessages).map(
                  ([topicKey, topicMessages]) => (
                    <View key={topicKey} className="mb-8">
                      <Text className="mb-2 text-xl text-center font-bold text-black">
                        {getTopicDisplayName(topicKey)}
                      </Text>
                      {topicMessages.map((message) => (
                        <MessageSetup
                          key={message.id}
                          messageData={message}
                          onUpdate={handleUpdateMessage}
                          onDelete={() => handleDeleteMessage(message.id)}
                        />
                      ))}
                    </View>
                  )
                )
              ) : (
                <View className="items-center justify-center rounded-lg bg-gray-100 p-8 mb-8">
                  <Text className="text-center text-xl text-gray-600">
                    {t("noMessages")}
                  </Text>
                </View>
              )}

              {/* Legal Support Form Section */}
              <View className="my-8">
                <Text className="mb-4 text-center text-xl font-bold text-black">
                  {t("optionalLegalSupport")}
                </Text>

                {legalSupportData ? (
                  <>
                    <LegalSupportForm
                      initialData={legalSupportData}
                      onSave={handleLegalSupportChange}
                      saveButtonText={t("updateLegalInfo")}
                      showSkipButton={false}
                      showTitle={false}
                      showExplanatoryText={false}
                      hideButtons={true}
                    />
                    
                    {/* Cancel Optional Legal Support Button */}
                    <View className="mt-4">
                      <Button
                        text={t("cancelLegalSupport" as any)}
                        onPress={handleCancelLegalSupport}
                        style={{ backgroundColor: "#f3f4f6" }}
                        textStyle={{ color: "#dc2626" }}
                      />
                    </View>
                  </>
                ) : (
                  <View className="items-center justify-center rounded-lg bg-gray-100 p-8 mb-8">
                    <Text className="text-center text-xl text-gray-600">
                      {t("noLegalInfo")}
                    </Text>
                    <Button
                      text={t("addLegalInfo")}
                      onPress={() =>
                        router.push(
                          "/screens/emergency-plan/optional-legal-support"
                        )
                      }
                      style={{ backgroundColor: "#6776cc" }}
                      className="mt-4"
                    />
                  </View>
                )}
              </View>
            </>
          )}

          <View className="mb-8">
            <Button
              text={t("saveAndContinue")}
              onPress={handleFinish}
              disabled={!hasData}
              style={{
                backgroundColor: "#6776cc",
                opacity: hasData ? 1 : 0.5,
              }}
            />
          </View>
        </ScrollView>

          <EmergencyPlanBottomNavigation />
      </View>

      {/* Error Modal */}
      <CustomModal
        visible={errorModalVisible}
        title={errorModalTitle}
        message={errorModalMessage}
        onClose={() => setErrorModalVisible(false)}
        buttons={[
          {
            text: t("ok"),
            onPress: () => setErrorModalVisible(false),
            type: "secondary",
          },
        ]}
      />

      {/* Delete Confirmation Modal */}
      <CustomModal
        visible={deleteModalVisible}
        title={t("deleteMessage")}
        message={t("deleteConfirmation")}
        onClose={() => {
          setDeleteModalVisible(false);
          setMessageToDeleteId(null);
        }}
        buttons={[
          {
            text: t("cancel"),
            onPress: () => {
              setDeleteModalVisible(false);
              setMessageToDeleteId(null);
            },
            type: "secondary",
          },
          {
            text: t("delete"),
            onPress: confirmDeleteMessage,
            type: "danger",
          },
        ]}
      />

      {/* Plan Saved Confirmation Modal */}
      <CustomModal
        visible={planSavedModalVisible}
        title={t("planSavedTitle")}
        message={`${t("planSavedMessage1")}\n\n${t("planSavedMessage2")}`}
        onClose={handlePlanSavedModalClose}
        buttons={[
          {
            text: t("close"),
            onPress: handlePlanSavedModalClose,
            type: "primary",
          },
        ]}
      />
    </SafeAreaView>
  );
}
