import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import type { MessageData } from "../../components/MessageSetup";
import {
  loadEmergencyPlanData,
  saveEmergencyPlanData,
} from "../../utils/storage-utils";
import { getDefaultMessageByTopic } from "../../utils/default-messages";
import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { MessageSetup } from "../../components/MessageSetup";
import { CustomModal } from "../../components/CustomModal";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

// Define the raw topic IDs here to maintain consistent IDs
const TOPIC_IDS = {
  CHILD_CARE: "Child / Family Care",
  ELDERLY_CARE: "Elderly Dependent Care",
  PET_CARE: "Pet Care",
  WORK_ABSENCES: "Work Absences",
  OTHER: "Other",
};

export default function TopicMessageSetup() {
  const router = useRouter();
  const { topicIndex } = useLocalSearchParams<{ topicIndex: string }>();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [currentTopicLabel, setCurrentTopicLabel] = useState<string>("");
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("topic-message-setup", settings.language);
  const { t: additionalTopicsT } = usePageTranslation(
    "additional-topics",
    settings.language
  );

  // Memoize TOPICS to prevent recreation on every render
  const TOPICS = useMemo(
    () => [
      { id: TOPIC_IDS.CHILD_CARE, label: additionalTopicsT("childCare") },
      { id: TOPIC_IDS.ELDERLY_CARE, label: additionalTopicsT("elderlyCare") },
      { id: TOPIC_IDS.PET_CARE, label: additionalTopicsT("petCare") },
      { id: TOPIC_IDS.WORK_ABSENCES, label: additionalTopicsT("workAbsences") },
      { id: TOPIC_IDS.OTHER, label: additionalTopicsT("other") },
    ],
    [additionalTopicsT]
  );

  // State for error modal
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState("");
  const [errorModalMessage, setErrorModalMessage] = useState("");
  const [showSchoolReminderModal, setShowSchoolReminderModal] = useState(false);

  // State for delete confirmation modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(
    null
  );

  // Method to show the error modal
  const showErrorModal = useCallback((title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  }, []);

  // Memoize the createDefaultMessage function to prevent recreation on every render
  const createDefaultMessage = useCallback(
    (topic: string): MessageData => ({
      id: Date.now().toString(),
      topic,
      message: getDefaultMessageByTopic(topic, settings.language),
      contacts: [
        {
          id: Date.now().toString() + "-1",
          name: "",
          phoneNumber: "",
        },
      ],
    }),
    [settings.language]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load selected topics
        const storedTopics = await SecureStore.getItemAsync(
          "selected_additional_topics"
        );
        if (!storedTopics) {
          router.replace("/screens/emergency-plan/additional-topics");
          return;
        }

        const parsedTopics = JSON.parse(storedTopics) as string[];
        setSelectedTopics(parsedTopics);

        // Get current topic based on index
        const index = parseInt(topicIndex || "0", 10);
        if (index >= parsedTopics.length) {
          // If index is out of bounds, go to review
          router.replace("/screens/emergency-plan/review");
          return;
        }

        const currentTopic = parsedTopics[index];

        // Find topic label
        const topicObj = TOPICS.find((t) => t.id === currentTopic);
        if (topicObj) {
          setCurrentTopicLabel(topicObj.label);
        } else {
          setCurrentTopicLabel(currentTopic ?? "");
        }

        // Load existing messages for this topic
        const { messages: loadedMessages } = await loadEmergencyPlanData();

        // Important: When filtering messages, use the topic ID (not the translated label)
        // to ensure consistent identification across languages
        const topicMessages = loadedMessages.filter((msg: MessageData) => {
          // Check if the message was created for this topic
          // Previously saved messages might have the translated topic name,
          // so we need to check both the ID and any possible translated label
          const currentTopicId = currentTopic;
          return (
            msg.topic === currentTopicId ||
            msg.topic === (topicObj?.label ?? currentTopic)
          );
        });

        if (topicMessages.length > 0) {
          setMessages(topicMessages);
        } else {
          // Initialize with a default message
          setMessages([
            createDefaultMessage(
              currentTopic // Store topic ID instead of translated label
            ),
          ]);
        }
      } catch (error) {
        console.error(
          "Error loading topic data:",
          error instanceof Error ? error.message : String(error)
        );
        router.replace("/screens/emergency-plan/additional-topics");
      }
    };

    void loadData();
    // topicIndex is a stable reference from the URL parameters
    // TOPICS and router are stable with useMemo/useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicIndex, router, createDefaultMessage]);

  const handleUpdateMessage = useCallback((updatedMessage: MessageData) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === updatedMessage.id ? updatedMessage : msg
      )
    );
  }, []);

  const handleDeleteMessage = useCallback((id: string) => {
    setMessageToDeleteId(id);
    setDeleteModalVisible(true);
  }, []);

  const confirmDeleteMessage = useCallback(() => {
    if (messageToDeleteId) {
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== messageToDeleteId)
      );
      setMessageToDeleteId(null);
    }
    setDeleteModalVisible(false);
  }, [messageToDeleteId]);

  const handleCreateAnotherMessage = useCallback(() => {
    // Get the topic ID instead of the translated label
    const currentTopicId =
      TOPICS.find((t) => t.label === currentTopicLabel)?.id ||
      currentTopicLabel;
    const newMessage = createDefaultMessage(currentTopicId);
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  }, [createDefaultMessage, currentTopicLabel, TOPICS]);

  const navigateToNextScreen = useCallback(() => {
    const nextIndex = parseInt(topicIndex || "0", 10) + 1;
    if (nextIndex < selectedTopics.length) {
      router.push({
        pathname: "/screens/emergency-plan/topic-message-setup",
        params: { topicIndex: nextIndex.toString() },
      });
    } else {
      router.push("/screens/emergency-plan/review");
    }
  }, [router, selectedTopics.length, topicIndex]);

  const hasDuplicateContacts = useCallback(
    (contacts: MessageData["contacts"]): boolean => {
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
    },
    []
  );

  const handleSaveAndContinue = useCallback(async () => {
    // Validate messages
    for (const msg of messages) {
      if (!msg.message.trim()) {
        showErrorModal(t("errorTitle"), t("errorEmptyMessage"));
        return;
      }

      for (const contact of msg.contacts) {
        if (!contact.name.trim() || !contact.phoneNumber.trim()) {
          showErrorModal(t("errorTitle"), t("errorEmptyContact"));
          return;
        }
      }

      if (hasDuplicateContacts(msg.contacts)) {
        showErrorModal(t("errorTitle"), t("errorDuplicateContact"));
        return;
      }
    }

    try {
      // Load all existing messages
      const { messages: existingMessages } = await loadEmergencyPlanData();

      // Important: When filtering out existing messages for this topic,
      // use the current topic ID rather than the translated label
      const currentTopicId =
        TOPICS.find((t) => t.label === currentTopicLabel)?.id ||
        currentTopicLabel;

      // Filter out any existing messages for this topic by checking both ID and label
      const otherMessages = existingMessages.filter(
        (msg) => msg.topic !== currentTopicId && msg.topic !== currentTopicLabel
      );

      // Prepare messages with the consistent topic ID
      const preparedMessages = messages.map((msg) => ({
        ...msg,
        topic: currentTopicId, // Use the ID not the translated label
      }));

      // Combine with other topic messages
      const allMessages = [...otherMessages, ...preparedMessages];

      // Save all messages
      await saveEmergencyPlanData(allMessages);

      // Check if this is a childcare message - show school reminder modal
      if (currentTopicId === TOPIC_IDS.CHILD_CARE) {
        setShowSchoolReminderModal(true);
      } else {
        // Navigate to next topic or review
        navigateToNextScreen();
      }
    } catch (error) {
      console.error(
        "Error saving emergency plan data:",
        error instanceof Error ? error.message : String(error)
      );
      showErrorModal(t("errorTitle"), t("errorSaving"));
    }
  }, [
    messages,
    currentTopicLabel,
    navigateToNextScreen,
    showErrorModal,
    t,
    TOPICS,
    hasDuplicateContacts,
  ]);

  const handleSkip = useCallback(() => {
    const nextIndex = parseInt(topicIndex || "0", 10) + 1;
    if (nextIndex < selectedTopics.length) {
      router.push({
        pathname: "/screens/emergency-plan/topic-message-setup",
        params: { topicIndex: nextIndex.toString() },
      });
    } else {
      router.push("/screens/emergency-plan/review");
    }
  }, [topicIndex, selectedTopics.length, router]);

  if (!currentTopicLabel) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Stack.Screen
          options={{
            title: t("loading"),
            headerTitleAlign: "center",
          }}
        />
        <View className="flex h-full w-full justify-center items-center bg-white">
          <Text>{t("loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Helper function to get the localized content for each topic
  const getTopicContent = () => {
    if (currentTopicLabel === additionalTopicsT("childCare")) {
      return (
        <View>
          <Text className="text-xl">{t("childCareInfo1")}</Text>
          <Text className="text-xl">{t("childCareInfo2")}</Text>
          <Text className="text-xl">{t("childCareInfo4")}</Text>
          <Text className="text-xl">{t("childCareInfo5")}</Text>
        </View>
      );
    } else if (currentTopicLabel === additionalTopicsT("elderlyCare")) {
      return (
        <View>
          <Text className="text-xl">{t("elderlyCareInfo1")}</Text>
          <Text className="text-xl">{t("elderlyCareInfo2")}</Text>
          <Text className="text-xl">{t("elderlyCareInfo3")}</Text>
          <Text className="text-xl">{t("elderlyCareInfo4")}</Text>
        </View>
      );
    } else if (currentTopicLabel === additionalTopicsT("petCare")) {
      return (
        <View>
          <Text className="text-xl">{t("petCareInfo1")}</Text>
          <Text className="text-xl">{t("petCareInfo2")}</Text>
          <Text className="text-xl">{t("petCareInfo3")}</Text>
          <Text className="text-xl">{t("petCareInfo4")}</Text>
          <Text className="text-xl">{t("petCareInfo5")}</Text>
        </View>
      );
    } else if (currentTopicLabel === additionalTopicsT("workAbsences")) {
      return (
        <View>
          <Text className="text-lg text-gray-700">
            {t("workAbsencesInfo1")}
          </Text>
        </View>
      );
    }

    return null;
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
            <Text className="mb-4 text-center text-2xl font-bold text-black">
              {t("messagesTitle").replace("{topicLabel}", currentTopicLabel)}
            </Text>
            <Text className="p-4 text-left text-xl leading-6 text-gray-700">
              {t("wantedToCreate").replace(
                "{topicLabel}",
                currentTopicLabel.toLowerCase()
              )}
            </Text>
            <View>
              {currentTopicLabel === additionalTopicsT("workAbsences") ? (
                <Text className="p-4 text-left text-xl leading-6 text-gray-700">
                  {t("workAbsencesInfo")}
                </Text>
              ) : currentTopicLabel === additionalTopicsT("other") ? null : (
                <Text className="p-4 text-left text-xl leading-6 text-gray-700">
                  {t("recommendedInfo")}
                </Text>
              )}

              <View className="px-4">{getTopicContent()}</View>
              <Text className="p-4 text-lg text-gray-700 font-bold">
                {t("editSample")}
              </Text>
              <Text className="p-4 text-lg text-gray-700 font-bold">
                {t("onlySentIf")}
              </Text>
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
              className="mb-4 rounded-3xl"
            />
            <View className="py-4 border-t border-gray-200 bg-white">
              <Button
                text={t("skip")}
                textStyle={{ color: "#6776cc" }}
                className="mb-4"
                onPress={handleSkip}
                style={{ backgroundColor: "#edf0fc" }}
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
            type: "primary",
          },
        ]}
      />

      {/* Delete Confirmation Modal */}
      <CustomModal
        visible={deleteModalVisible}
        title={t("deleteTitle")}
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

      {/* School Pickup Reminder Modal */}
      <CustomModal
        visible={showSchoolReminderModal}
        title={t("schoolReminderTitle")}
        message={t("schoolReminderMessage")}
        onClose={() => {
          setShowSchoolReminderModal(false);
          navigateToNextScreen();
        }}
        buttons={[
          {
            text: t("close"),
            onPress: () => {
              setShowSchoolReminderModal(false);
              navigateToNextScreen();
            },
            type: "primary",
          },
        ]}
      />
    </SafeAreaView>
  );
}
