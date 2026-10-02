import React, { useMemo, useState } from "react";
import { Clipboard, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { Ionicons } from "@expo/vector-icons";

import Button from "./Button";
import { MessageSetup } from "./MessageSetup";
import { LegalSupportForm, LegalSupportData } from "./LegalSupportForm";
import { ALL_TOPICS } from "../types/all-topics";
import type { MessageData } from "./MessageSetup";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

interface PlanTabProps {
  messages: MessageData[];
  loading: boolean;
  legalSupportData: LegalSupportData | null;
  isSavingDebounced: boolean;
  onUpdateMessage: (updatedMessage: MessageData) => void;
  onDeleteMessage: (id: string) => void;
  onAddMessage: (topic: string) => void;
  onWipePlanData: () => void;
  onSaveLegalSupport: (formData: LegalSupportData) => void;
  onCancelLegalSupport: () => void;
  defaultLegalSupportData: LegalSupportData;
}

const PlanTab: React.FC<PlanTabProps> = ({
  messages,
  loading,
  legalSupportData,
  isSavingDebounced,
  onUpdateMessage,
  onDeleteMessage,
  onAddMessage,
  onWipePlanData,
  onSaveLegalSupport,
  onCancelLegalSupport,
  defaultLegalSupportData,
}) => {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t: tOptional } = usePageTranslation(
    "optional-legal-support",
    settings.language
  );
  const { t } = usePageTranslation("plan-tab", settings.language);
  const { t: tSecureCopy } = usePageTranslation("secure-copy", settings.language);
  const [copied, setCopied] = useState(false);

  // Organize messages by standard topic names, handling translated topic names
  const organizedMessages = useMemo(() => {
    const result: Record<string, MessageData[]> = {};

    // Initialize empty arrays for all standard topics
    ALL_TOPICS.forEach((topic) => {
      result[topic] = [];
    });

    // Process each message and assign to the correct standard topic
    messages.forEach((message) => {
      const topic = message.topic;

      // First check if it's an exact match with any standard topic
      if (ALL_TOPICS.includes(topic)) {
        // If the topic exactly matches one of our standard topics, use it directly
        result[topic].push(message);
      } else if (
        // Handle legal support messages with translated topic names
        topic === "Legal Support" ||
        topic.includes("법적지원") || // Korean
        topic.includes("Apoyo Legal") || // Spanish
        topic.includes("Legal")
      ) {
        // Handle partial matches too
        result["Legal Support"].push({
          ...message,
          topic: "Legal Support", // Standardize topic name for consistency
        });
      } else {
        // For other topics, try to find a matching standard topic
        const standardTopic = ALL_TOPICS.find(
          (stdTopic) => topic.includes(stdTopic)
        );

        if (standardTopic) {
          result[standardTopic].push(message);
        } else {
          // If no match found, use the first matching word as a fallback
          const matchingTopic = ALL_TOPICS.find((stdTopic) =>
            topic.includes(stdTopic.split(" ")[0])
          );

          if (matchingTopic) {
            result[matchingTopic].push(message);
          } else {
            // If still no match, put it in Personal Emergency as default
            result["Personal Emergency"].push(message);
          }
        }
      }
    });

    return result;
  }, [messages]);

  const handleUpdateMessage = (updatedMessage: MessageData) => {
    // Pass message directly to parent without modifications
    onUpdateMessage(updatedMessage);
  };

  const formatTopicMessage = (topic: string, isEmpty: boolean) => {
    // Get translated components
    const action = isEmpty ? t("addFirst") : t("add");
    const messageType = t("message");

    // Translate the topic based on known topics
    let translatedTopic = topic;
    if (topic === "Personal Emergency")
      translatedTopic = t("personalEmergency");
    else if (topic === "Legal Support") translatedTopic = t("legalSupport");
    else if (topic === "Child / Family Care")
      translatedTopic = t("childFamilyCare");
    else if (topic === "Elderly Dependent Care")
      translatedTopic = t("elderlyDependentCare");
    else if (topic === "Pet Care") translatedTopic = t("petCare");
    else if (topic === "Work Absences") translatedTopic = t("workAbsences");

    // Format based on language
    if (settings.language === "kr") {
      // Korean: {topic} {type} {action}
      return `${translatedTopic} ${messageType} ${action}`;
    } else if (settings.language === "es") {
      // Spanish: {action} {type} de {topic}
      return `${action} ${messageType} de ${translatedTopic}`;
    } else {
      // English: {action} {topic} {type}
      return `${action} ${translatedTopic} ${messageType}`;
    }
  };

  const formatEmergencyPlan = (messages: MessageData[]): string => {
    if (!messages || messages.length === 0) {
      return tSecureCopy("noPlanData");
    }

    let formatted = tSecureCopy("myEmergencyPlan") + "\n";
    formatted += "=".repeat(40) + "\n\n";

    messages.forEach((message, index) => {
      formatted += `${tSecureCopy("message")} ${index + 1}: ${message.topic}\n`;
      formatted += "-".repeat(40) + "\n";
      formatted += `${tSecureCopy("messageContent")}:\n${message.message}\n\n`;

      if (message.contacts && message.contacts.length > 0) {
        formatted += `${tSecureCopy("contacts")}:\n`;
        message.contacts.forEach((contact, contactIndex) => {
          formatted += `  ${contactIndex + 1}. ${contact.name} - ${contact.phoneNumber}\n`;
        });
        formatted += "\n";
      } else {
        formatted += `${tSecureCopy("noContacts")}\n\n`;
      }

      formatted += "\n";
    });

    formatted += "=".repeat(40) + "\n";
    formatted += `${tSecureCopy("generatedBy")} ReadyNow\n`;
    formatted += tSecureCopy("keepSafe");

    return formatted;
  };

  const copyToClipboard = () => {
    const planText = formatEmergencyPlan(messages);
    Clipboard.setString(planText);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  return (
    <View className="flex-1 p-4">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-gray-600">{t("loading")}</Text>
        </View>
      ) : messages.length === 0 && !legalSupportData ? (
        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-center text-lg text-gray-600">
            {t("noPlanYet")}
          </Text>
          <Button
            text={t("createEmergencyPlan")}
            onPress={() => router.push("/screens/emergency-plan" as any)}
            style={{ backgroundColor: "#6776cc" }}
          />
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
          {/* Messages Section */}
          <Text className="mb-4 text-center text-3xl font-bold text-gray-600">
            {t("yourEmergencyPlan")}
          </Text>

          {/* Group existing messages by topic */}
          {ALL_TOPICS.map((topic) => {
            const topicMessages = organizedMessages[topic] || [];
            return (
              <View key={topic} className="mb-8">
                {topicMessages.length > 0 && (
                  <Text className="mb-2 text-xl font-semibold text-gray-700">
                    {topic}
                  </Text>
                )}

                {topicMessages.map((message) => (
                  <MessageSetup
                    key={message.id}
                    messageData={message}
                    onUpdate={handleUpdateMessage}
                    onDelete={() => onDeleteMessage(message.id)}
                    showDeleteButton={true}
                    readOnly={false}
                  />
                ))}

                {/* Show add message button for every topic */}
                <TouchableOpacity
                  className="mt-2 flex-row items-center justify-center rounded-3xl bg-[#60646c] p-3"
                  onPress={() => {
                    void onAddMessage(topic);
                  }}
                >
                  <Text className="ml-2 font-medium text-white">
                    {formatTopicMessage(topic, topicMessages.length === 0)}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Legal Support Form Section */}
          <View className="mt-8 mb-8">
            <Text className="mb-4 text-center text-xl font-bold text-black">
              {t("legalSupportTitle")}
            </Text>

            {legalSupportData ? (
              <>
                <LegalSupportForm
                  initialData={legalSupportData}
                  onSave={onSaveLegalSupport}
                  saveButtonText={t("updateLegalSupportInfo")}
                  showSkipButton={false}
                  showTitle={false}
                  showExplanatoryText={false}
                />
                
                {/* Cancel Legal Support Button */}
                <View className="mt-4">
                  <Button
                    text={t("cancelLegalSupport" as any)}
                    onPress={onCancelLegalSupport}
                    style={{ backgroundColor: "#f3f4f6", width: "100%" }}
                    textStyle={{ color: "#dc2626" }}
                  />
                </View>
              </>
            ) : (
              <View className="w-full px-4 py-4">
                <Text className="mb-4 text-center text-lg text-gray-600">
                  {t("noLegalSupport")}
                </Text>
                <Button
                  text={t("addLegalSupportInfo")}
                  onPress={() => onSaveLegalSupport(defaultLegalSupportData)}
                  style={{ backgroundColor: "#6776cc", width: "100%" }}
                />
              </View>
            )}
          </View>

          <View className="w-full">
            <TouchableOpacity
              className="mb-4 flex-row items-center justify-center rounded-3xl bg-[#6776cc] p-3 w-full"
              onPress={copyToClipboard}
            >
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={20}
                color="white"
              />
              <Text className="ml-2 font-medium text-white">
                {copied ? t("planCopied") : t("copyPlanToClipboard")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mb-4 flex-row items-center justify-center rounded-3xl bg-[#FF3B30] p-3 w-full"
              onPress={onWipePlanData}
            >
              <Feather name="trash-2" size={20} color="white" />
              <Text className="ml-2 font-medium text-white">
                {t("deleteMyEmergencyPlan")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default PlanTab;
