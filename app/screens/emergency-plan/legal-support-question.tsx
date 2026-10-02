import React, { useState } from "react";
import {
  Text,
  View,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function LegalSupportQuestion() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("legal-support-question", settings.language);
  const [selection, setSelection] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 360 || height < 640;

  // State for managing custom modal
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  // Method to show the custom modal
  const showCustomModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setShowModal(true);
  };

  const handleSelection = (value: string) => {
    setSelection(value);
  };

  const handleNext = async () => {
    if (selection) {
      try {
        // Store the user's selection
        await SecureStore.setItemAsync("has_legal_support", selection);

        if (selection === "yes") {
          router.push("/screens/emergency-plan/legal-support-setup");
        } else {
          // Skip legal support setup and go to personal messages info
          router.push("/screens/emergency-plan/optional-legal-support");
        }
      } catch (error) {
        console.error(
          "Error saving selection:",
          error instanceof Error ? error.message : String(error)
        );
      }
    } else {
      // Prompt user to make a selection
      showCustomModal(t("selectionRequired"), t("pleaseSelect"));
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
      <View className="flex-1 bg-white">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 160 }} // Add padding to account for the fixed button and bottom navigation
          showsVerticalScrollIndicator={true}
        >
          <View className="p-5">
            <Text
              className={`text-center ${
                isSmallScreen ? "text-2xl" : "text-3xl"
              } font-bold`}
            >
              {t("legalSupport")}
            </Text>
            <View className="mt-8 px-4">
              <Text
                className={`mb-2 ${
                  isSmallScreen ? "text-lg" : "text-xl"
                } font-bold text-black`}
              >
                {t("question")}
              </Text>

              <Text
                className={`mb-8 ${
                  isSmallScreen ? "text-sm" : "text-base"
                } leading-6 text-gray-700`}
              >
                {t("example")}
              </Text>
            </View>

            <View className="mt-5 px-4">
              <Button
                text={t("yes")}
                onPress={() => handleSelection("yes")}
                style={{
                  backgroundColor: selection === "yes" ? "#bfc0cb" : "#E0E0E0",
                }}
                textStyle={{
                  color: selection === "yes" ? "#60646c" : "#000",
                }}
                className="mb-4"
              />

              <Button
                text={t("no")}
                onPress={() => handleSelection("no")}
                style={{
                  backgroundColor: selection === "no" ? "#bfc0cb" : "#E0E0E0",
                }}
                textStyle={{
                  color: selection === "no" ? "#60646c" : "#000",
                }}
                className="mb-4"
              />
              <Button
                text={t("unknown")}
                onPress={() => handleSelection("unknown")}
                style={{
                  backgroundColor:
                    selection === "unknown" ? "#bfc0cb" : "#E0E0E0",
                }}
                textStyle={{
                  color: selection === "unknown" ? "#60646c" : "#000",
                }}
              />
            </View>
          </View>
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-5 z-10">
          <Button
            text={t("continue")}
            onPress={handleNext}
            disabled={!selection}
            style={{
              backgroundColor: selection ? "#6776cc" : "#E0E0E0",
            }}
            textStyle={{
              color: selection ? "#FFF" : "#888",
            }}
          />
        </View>
      </View>

      {/* Custom Modal */}
      <Modal visible={showModal} transparent={true} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 p-5">
          <View className="w-full max-w-md items-center rounded-xl bg-white p-5">
            <Text
              className={`mb-4 text-center ${
                isSmallScreen ? "text-xl" : "text-2xl"
              } font-bold`}
            >
              {modalTitle}
            </Text>
            <Text
              className={`mb-2.5 text-center ${
                isSmallScreen ? "text-sm" : "text-base"
              } text-gray-600`}
            >
              {modalMessage}
            </Text>

            <Button
              text={t("ok")}
              onPress={() => setShowModal(false)}
              style={{ backgroundColor: "#8c8d98", marginTop: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
        <EmergencyPlanBottomNavigation />
    </SafeAreaView>
  );
}
