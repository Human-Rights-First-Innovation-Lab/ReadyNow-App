import React, { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import Button from "../../components/Button";
import { useAuth } from "../../utils/use-auth";
import { formatPhoneNumberForAuth0 } from "../../utils/auth-config";
import { CustomModal } from "../../components/CustomModal";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";
import { EnhancedTextInput } from "../../components/EnhancedTextInput";

export default function CreateAccountScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("createaccount", settings.language);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // State for error modal
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState("");
  const [errorModalMessage, setErrorModalMessage] = useState("");

  // Method to show the error modal
  const showErrorModal = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const handlePhoneChange = (text: string) => {
    // Remove any non-digit characters
    const cleaned = text.replace(/\D/g, "");

    // Limit to 10 digits (US phone number without country code)
    const truncated = cleaned.substring(0, 10);

    setPhoneNumber(truncated);
  };

  // Format phone number for display: (xxx)-xxx-xxxx
  const formatPhoneForDisplay = (phoneDigits: string) => {
    if (!phoneDigits) return "";

    const match = phoneDigits.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return phoneDigits;

    const parts = [match[1], match[2], match[3]].filter(Boolean);

    if (parts.length === 0) return "";
    if (parts.length === 1) return `(${parts[0]}`;
    if (parts.length === 2) return `(${parts[0]})-${parts[1]}`;
    return `(${parts[0]})-${parts[1]}-${parts[2]}`;
  };

  const handleContinue = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      showErrorModal(t("errorTitle"), t("errorMessage"));
      return;
    }

    // Dismiss keyboard
    Keyboard.dismiss();

    setIsLoading(true);
    try {
      // Apple Review bypass - REMOVE BEFORE PRODUCTION
      if (phoneNumber === "5555551234") {
        // Navigate directly to OTP with reviewer bypass
        router.push({
          pathname: "/otp-verification",
          params: {
            phoneNumber: "+15555551234",
            reviewerMode: "true", // Special flag for reviewer
          },
        });
        setIsLoading(false);
        return;
      }

      // Format phone number for display purposes
      const formattedNumber = formatPhoneNumberForAuth0(phoneNumber);

      // Request the SMS code
      const success = await login(phoneNumber);

      if (success) {
        // Navigate to OTP input screen, passing the phone number
        router.push({
          pathname: "/otp-verification",
          params: { phoneNumber: formattedNumber },
        });
      } else {
        throw new Error("Failed to send verification code");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      showErrorModal(t("errorTitle2"), t("errorMessage2"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "always" : "never"}
        >
            <View className="w-full bg-white px-4">
              <Text className="pb-4 text-center text-3xl font-bold text-gray-600">
                {t("login")}
              </Text>
              <View className="mt-4 px-4">
                <Text className="p-4 text-center text-lg text-gray-600">
                  {t("securityInfo")}
                </Text>
                <Text className="mt-4 p-4 text-center text-lg text-gray-600">
                  {t("noEmailPassword")}
                </Text>
              </View>
              <View className="mt-8">
                <Text className="mb-2 text-center text-lg text-gray-600">
                  {t("enterPhone")}
                </Text>
                <View className="mt-4 flex-row items-center rounded-lg border border-gray-300">
                  <EnhancedTextInput
                    ref={inputRef}
                    className="flex-1 p-4 text-lg"
                    placeholder={t("phonePlaceholder")}
                    keyboardType="phone-pad"
                    value={formatPhoneForDisplay(phoneNumber)}
                    onChangeText={handlePhoneChange}
                    style={{ textAlignVertical: "center" }}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                    doneButtonText={t("continue")}
                  />
                </View>
                {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                  <Text className="mt-1 text-red-500">
                    {t("phoneValidationError")}
                  </Text>
                )}
              </View>
              <Text className="mt-4 text-center text-lg text-gray-600">
                {t("messageRates")}
              </Text>
              <View className="my-8">
                <Text className="text-center text-md text-gray-600">
                  {t("termsAgreement")}{" "}
                  <Text className="underline">{t("privacyPolicy")}</Text>
                  <Text> {t("and")} </Text>
                  <Text className="underline">{t("termsOfService")}</Text>
                </Text>
              </View>
              <View className="mt-2 mb-4">
                <Button
                  text={isLoading ? t("sending") : t("continue")}
                  onPress={handleContinue}
                  style={{ backgroundColor: "#6776cc" }}
                  disabled={isLoading || phoneNumber.length !== 10}
                />
              </View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
}
