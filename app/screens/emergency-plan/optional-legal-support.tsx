import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import {
  LegalSupportForm,
  LegalSupportData,
} from "../../components/LegalSupportForm";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function OptionalLegalSupportScreen() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("optional-legal-support", settings.language);
  const [initialData, setInitialData] = useState<Partial<LegalSupportData> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Load any existing saved data or draft on mount
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        // First check for final saved data
        const savedData = await SecureStore.getItemAsync("additionalLegalHelp");
        if (savedData) {
          const parsed = JSON.parse(savedData) as LegalSupportData;
          setInitialData(parsed);
          setIsLoading(false);
          return;
        }

        // If no saved data, check for draft
        const draftData = await SecureStore.getItemAsync("additionalLegalHelp_draft");
        if (draftData) {
          const parsed = JSON.parse(draftData) as LegalSupportData;
          setInitialData(parsed);
        }
      } catch (error) {
        console.error("Error loading existing legal support data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadExistingData();
  }, []);

  const handleSaveAndContinue = async (formData: LegalSupportData) => {
    try {
      // Save form data to SecureStore
      await SecureStore.setItemAsync(
        "additionalLegalHelp",
        JSON.stringify(formData)
      );

      // Navigate to next screen (skip personal-messages-info)
      router.push("/screens/emergency-plan/personal-message-setup");
    } catch (error) {
      console.error("Error saving legal support data:", error);
      // You could show an error message here
    }
  };

  const handleSkip = () => {
    // Navigate to next screen without saving (skip personal-messages-info)
    router.push("/screens/emergency-plan/personal-message-setup");
  };

  const getFormTranslations = () => {
    return {
      additionalLegalHelp: t("additionalLegalHelp"),
      instructions: t("instructions"),
      nameLabel: t("nameLabel"),
      namePlaceholder: t("namePlaceholder"),
      phoneLabel: t("phoneLabel"),
      phonePlaceholder: t("phonePlaceholder"),
      emailLabel: t("emailLabel"),
      emailPlaceholder: t("emailPlaceholder"),
      notesLabel: t("notesLabel"),
      notesPlaceholder: t("notesPlaceholder"),
      skip: t("skip"),
      validationErrorTitle: t("validationErrorTitle"),
      validationErrorMessage: t("validationErrorMessage"),
      missingFields: t("missingFields"),
      requiredFields: t("requiredFields"),
      ok: t("ok"),
      emergencyContactPhoneInvalid: t("emergencyContactPhoneInvalid"),
      emergencyContactNameInvalid: t("emergencyContactNameInvalid"),
      aNumberInvalid: t("aNumberInvalid"),
      emergencyContactEmailRequired: t("emergencyContactEmailRequired"),
      emergencyContactEmailInvalid: t("emergencyContactEmailInvalid"),
    };
  };

  return (
    <SafeAreaView style={styles.container} className="bg-background">
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

      <View style={{ flex: 1 }}>
      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.container}
          keyboardVerticalOffset={100}
        >
          <ScrollView
            className="flex-1 bg-white"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {!isLoading && (
              <LegalSupportForm
                initialData={initialData}
                onSave={handleSaveAndContinue}
                onSkip={handleSkip}
                saveButtonText={t("saveAndContinue")}
                translations={getFormTranslations()}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        // On Android, use just a ScrollView without KeyboardAvoidingView
        <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {!isLoading && (
            <LegalSupportForm
              initialData={initialData}
              onSave={handleSaveAndContinue}
              onSkip={handleSkip}
              saveButtonText={t("saveAndContinue")}
              translations={getFormTranslations()}
            />
          )}
        </ScrollView>
      )}

          <EmergencyPlanBottomNavigation />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    // paddingBottom: 80, // Add extra padding at the bottom for Android
  },
});
