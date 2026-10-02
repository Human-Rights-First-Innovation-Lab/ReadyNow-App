import React, { useState, useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function AdditionalTopics() {
  const router = useRouter();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("additional-topics", settings.language);

  // Define the translated topics array
  const TOPICS = [
    { id: "Child / Family Care", label: t("childCare") },
    { id: "Elderly Dependent Care", label: t("elderlyCare") },
    { id: "Pet Care", label: t("petCare") },
    { id: "Work Absences", label: t("workAbsences") },
    { id: "Other", label: t("other") },
  ];

  // Load previously selected topics when component mounts
  useEffect(() => {
    const loadSelectedTopics = async () => {
      try {
        setIsLoading(true);
        const storedTopics = await SecureStore.getItemAsync(
          "selected_additional_topics"
        );

        if (storedTopics) {
          const parsedTopics = JSON.parse(storedTopics) as string[];
          setSelectedTopics(parsedTopics);
        }
      } catch (error) {
        console.error(
          "Error loading selected topics:",
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadSelectedTopics();
  }, []);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((id) => id !== topicId);
      } else {
        return [...prev, topicId];
      }
    });
  };

  const handleNext = async () => {
    try {
      // Store selected topics
      await SecureStore.setItemAsync(
        "selected_additional_topics",
        JSON.stringify(selectedTopics)
      );

      if (selectedTopics.length > 0) {
        // Navigate to the first selected topic's setup screen
        router.push({
          pathname: "/screens/emergency-plan/topic-message-setup",
          params: { topicIndex: "0" },
        });
      } else {
        // Skip to review if no additional topics selected
        router.push("/screens/emergency-plan/review");
      }
    } catch (error) {
      console.error(
        "Error saving selected topics:",
        error instanceof Error ? error.message : String(error)
      );
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
            fontSize: 20,          },
        }}
      />
      <View className="flex h-full w-full justify-between bg-white">
        <ScrollView className="px-5" style={{ paddingBottom: 80 }}>
          <Text className="mb-4 p-4 text-center text-3xl font-bold text-black">
            {t("additionalMessages")}
          </Text>

          <Text className="mb-6 p-4 text-left text-xl leading-6 text-gray-700">
            {(() => {
              const message = t("setupCustomMessages") || "";
              const childcare = t("childcareBold") || "";
              const workAbsences = t("workAbsencesBold") || "";

              const parts = message.split(childcare);
              const firstPart = parts[0] || "";
              const remainingText = parts[1] || "";

              const workParts = remainingText.split(workAbsences);
              const middlePart = workParts[0] || "";
              const lastPart = workParts[1] || "";

              return (
                <>
                  {firstPart}
                  <Text className="font-bold">{childcare}</Text>
                  {middlePart}
                  <Text className="font-bold">{workAbsences}</Text>
                  {lastPart}
                </>
              );
            })()}
          </Text>

          <Text className="mb-6 p-4 text-left text-xl leading-6 text-gray-700">
            <Text className="font-bold">{t("selectTopicsBold")}</Text>
            {t("selectAllApply")}
          </Text>

          <View className="mb-6">
            {isLoading ? (
              <View className="items-center p-5">
                <Text className="text-center text-lg text-gray-600">
                  {t("loading")}
                </Text>
              </View>
            ) : (
              TOPICS.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  className={`mb-3 flex-row items-center justify-between rounded-lg border p-4 ${
                    selectedTopics.includes(topic.id)
                      ? "border-blue-700 bg-[#6776cc]"
                      : "border-gray-200 bg-[#eeeef3]"
                  }`}
                  onPress={() => toggleTopic(topic.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`flex-1 text-center text-xl font-medium ${
                      selectedTopics.includes(topic.id)
                        ? "text-white"
                        : "text-[#60646c]"
                    }`}
                  >
                    {topic.label}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <Text className="mb-8 mt-2 text-sm italic text-gray-500">
            {t("infoText")}
          </Text>

          <View className="mb-8">
            <Button
              text={selectedTopics.length > 0 ? t("continue") : t("skip")}
              onPress={handleNext}
              style={{ backgroundColor: "#6776cc" }}
              disabled={isLoading}
            />
          </View>
        </ScrollView>
        <EmergencyPlanBottomNavigation />

        {/* Emergency Plan Bottom Navigation */}
      </View>
    </SafeAreaView>
  );
}
