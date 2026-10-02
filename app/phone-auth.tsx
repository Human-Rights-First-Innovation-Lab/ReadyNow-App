import React, { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";

import Button from "./components/Button";
import { requestSmsCode } from "./utils/auth-service";
import { formatPhoneNumberForAuth0 } from "./utils/auth-config";
import { useModal } from "./context/ModalContext";
import { EnhancedTextInput } from "./components/EnhancedTextInput";

export default function PhoneAuthScreen() {
  const router = useRouter();
  const { showError } = useModal();
  const { returnTo } = useLocalSearchParams();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
      showError("Please enter a valid 10-digit phone number");
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
          pathname: "otp-verification" as any,
          params: {
            phoneNumber: "+15555551234",
            returnTo: returnTo || "",
            reviewerMode: "true", // Special flag for reviewer
          },
        });
        setIsLoading(false);
        return;
      }

      // Format phone number to E.164 format for Auth0
      const formattedNumber = formatPhoneNumberForAuth0(phoneNumber);

      // Request SMS code through Auth0
      await requestSmsCode(phoneNumber);

      // Navigate to OTP input screen, passing both phone number and returnTo parameter
      router.push({
        pathname: "otp-verification" as any,
        params: {
          phoneNumber: formattedNumber,
          returnTo: returnTo || "",
        },
      });
    } catch (error) {
      console.error("Error sending OTP:", error);
      showError("Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
      <Stack.Screen
        options={{
          title: "Phone Verification",
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex h-full w-full justify-between bg-white p-4">
              <View>
                <Text className="pb-4 text-center text-3xl font-bold text-black">
                  Verify Your Phone
                </Text>
                <Text className="pb-6 text-center text-lg text-black">
                  We'll send you a verification code to confirm your identity
                </Text>

                <View className="mt-4">
                  <Text className="mb-2 text-lg text-black">Phone Number</Text>
                  <View className="flex-row items-center rounded-lg border border-gray-300">
                    <EnhancedTextInput
                      ref={inputRef}
                      className="flex-1 p-4 text-lg"
                      placeholder="(555)-123-4567"
                      keyboardType="phone-pad"
                      value={formatPhoneForDisplay(phoneNumber)}
                      onChangeText={handlePhoneChange}
                      style={{ textAlignVertical: "center" }}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleContinue}
                      doneButtonText="Done"
                    />
                  </View>
                  {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                    <Text className="mt-1 text-red-500">
                      Please enter a 10-digit phone number
                    </Text>
                  )}
                </View>
              </View>

              <View className="mb-8">
                <Button
                  text={isLoading ? "Sending..." : "Continue"}
                  onPress={handleContinue}
                  style={{ backgroundColor: "#000" }}
                  disabled={isLoading || phoneNumber.length !== 10}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
