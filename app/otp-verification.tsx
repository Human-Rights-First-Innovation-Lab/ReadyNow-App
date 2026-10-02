import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import Button from "./components/Button";
import { requestSmsCode, STORAGE_KEYS } from "./utils/auth-service";
import { useAuth } from "./utils/use-auth";
import { useModal } from "./context/ModalContext";
import { useAppSettings } from "./utils/app-settings";
import { usePageTranslation } from "./translations";
import { EnhancedTextInput } from "./components/EnhancedTextInput";
import { hasAnsweredCrashReportingPrompt } from "./utils/crash-reporting";
import { ensureDeviceCredential } from "./utils/device-credential";

export default function OTPVerificationScreen() {
  const router = useRouter();
  const { phoneNumber, returnTo, reviewerMode } = useLocalSearchParams();
  const { verifyCode, refreshAuthStatus } = useAuth();
  const { showError, showAlert, showSuccess } = useModal();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("otp-verification", settings.language);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdownSeconds, setCountdownSeconds] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Focus first input on mount and start countdown
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);

    // Start countdown for resend button
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (text: string, index: number) => {
    // Detect if a full code was pasted/autofilled (iOS autofill or manual paste)
    if (text.length > 1) {
      // Extract only numeric digits from the text
      const digits = text.replace(/\D/g, "");
      
      // If we have exactly 6 digits, distribute them across all inputs
      if (digits.length === 6) {
        const newOtp = digits.split("").slice(0, 6);
        setOtp(newOtp);
        // Focus the last input after autofill
        inputRefs.current[5]?.focus();
        return;
      }
      
      // If we have more than 6 digits, take only the first 6
      if (digits.length > 6) {
        const newOtp = digits.split("").slice(0, 6);
        setOtp(newOtp);
        inputRefs.current[5]?.focus();
        return;
      }
      
      // If we have less than 6 digits but more than 1, fill up to available digits
      if (digits.length > 0 && digits.length < 6) {
        const newOtp = [...otp];
        for (let i = 0; i < digits.length && index + i < 6; i++) {
          newOtp[index + i] = digits[i];
        }
        setOtp(newOtp);
        // Focus the next empty input or the last one if all filled
        const nextIndex = Math.min(index + digits.length, 5);
        inputRefs.current[nextIndex]?.focus();
        return;
      }
    }
    
    // Normal single character input handling
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-advance to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: { nativeEvent: { key: string } },
    index: number
  ) => {
    // Go back on delete when input is empty
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    // Dismiss keyboard
    Keyboard.dismiss();

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      showAlert(t("invalidCode"), t("pleaseEnter"));
      return;
    }

    setIsLoading(true);
    try {
      let success = false;

      // Apple Review bypass - REMOVE BEFORE PRODUCTION
      if (reviewerMode === "true" && String(phoneNumber) === "+15555551234") {
        // Accept any 6-digit code for reviewer
        success = true;

        // Simulate user authentication for reviewer
        const reviewerUserInfo = {
          phone: "+15555551234",
          isAuthenticated: true,
          userId: "reviewer_user",
          email: "reviewer@apple.com",
          name: "Apple Reviewer",
        };

        await SecureStore.setItemAsync(
          STORAGE_KEYS.AUTH_TOKEN,
          "reviewer_token"
        );
        await SecureStore.setItemAsync(
          STORAGE_KEYS.USER_INFO,
          JSON.stringify(reviewerUserInfo)
        );

        // Set onboarding as completed for reviewer to skip onboarding flow
        await SecureStore.setItemAsync(
          STORAGE_KEYS.ONBOARDING_COMPLETED,
          "false"
        );

        // Refresh auth context state to reflect the manual SecureStore changes
        await refreshAuthStatus();
      } else {
        // Normal verification flow
        success = await verifyCode(String(phoneNumber), otpCode);
      }

      if (!success) {
        throw new Error("Failed to verify code");
      }

      // Register this install's alert credential now, while connectivity is
      // good. ensureDeviceCredential() pulls a token via the credentials
      // manager rather than reading the one just stored, so this exercises
      // the exact same path that later heals the gap on app start / alert
      // screen mount if this attempt fails.
      try {
        await ensureDeviceCredential();
      } catch (error) {
        // Never block sign-in on this; the alert path falls back to reporting
        // an honest failure if no credential exists.
        console.error(
          "Could not register alert credential:",
          error instanceof Error ? error.message : String(error)
        );
      }

      // Work out where verification would normally land the user
      let destination: string;

      if (returnTo === "plan") {
        // Store the intended tab for the main page to pick up
        await SecureStore.setItemAsync(STORAGE_KEYS.INTENDED_TAB, "plan");

        // Navigate to main page (which will show the plan tab due to the intended_tab setting)
        destination = "main";
      } else {
        // Get the latest onboarding status
        const hasCompletedOnboarding = await SecureStore.getItemAsync(
          STORAGE_KEYS.ONBOARDING_COMPLETED
        );

        if (hasCompletedOnboarding === "false") {
          // User is new or hasn't completed onboarding
          destination = "/screens/emergency-plan";
        } else if (hasCompletedOnboarding === "true") {
          // User has completed onboarding, go to main
          destination = "main";
        } else {
          // Fallback - if value is undefined or other, go to first onboarding screen
          await SecureStore.setItemAsync(
            STORAGE_KEYS.ONBOARDING_COMPLETED,
            "false"
          );
          destination = "screens/welcome/beforeyoustart1";
        }
      }

      // Ask about crash reporting once, immediately after the account exists.
      // Until this is answered, Sentry has never been initialized. The consent
      // screen forwards to `destination`, so the flow is otherwise unchanged.
      if (!hasAnsweredCrashReportingPrompt()) {
        router.replace({
          pathname: "/screens/welcome/crash-reporting",
          params: { next: destination },
        } as any);
        return;
      }

      router.replace(destination as any);
    } catch {
      showError("Failed to verify code. Please try again.");
      // Clear OTP on error to prevent form from staying stuck
      setOtp(["", "", "", "", "", ""]);
      // Blur all inputs to reset focus
      inputRefs.current.forEach((ref) => ref?.blur());
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendDisabled) return;

    setResendDisabled(true);
    setCountdownSeconds(60);
    
    // Clear OTP state when requesting new code
    setOtp(["", "", "", "", "", ""]);
    // Blur all inputs to reset focus
    inputRefs.current.forEach((ref) => ref?.blur());
    // Focus first input after a brief delay
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);

    try {
      // Request new SMS code
      await requestSmsCode(String(phoneNumber));

      // Start countdown again
      const interval = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      showSuccess(t("newCodeSent"));
    } catch {
      showError("Failed to resend code. Please try again.");
      setResendDisabled(false);
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
          <View className="w-full bg-white p-4">
              <View>
                <Text className="pb-4 text-center text-3xl font-bold text-gray-600">
                  {t("enterCode")}
                </Text>

                <View style={styles.otpContainer} className="mt-16">
                  {otp.map((digit, index) => (
                    <EnhancedTextInput
                      key={index}
                      ref={(ref) => {
                        inputRefs.current[index] = ref;
                      }}
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={index === 0 ? 6 : 1}
                      returnKeyType="done"
                      textContentType={Platform.OS === "ios" && index === 0 ? "oneTimeCode" : undefined}
                      onSubmitEditing={() => {
                        if (index === 5) {
                          Keyboard.dismiss();
                          if (otp.every((d) => d !== "")) {
                            void handleVerify();
                          }
                        }
                      }}
                      doneButtonText={t("continue")}
                    />
                  ))}
                </View>
                <Text className="mt-16 pb-6 text-center text-lg text-gray-600">
                  {t("sentCode").replace("{phone}", String(phoneNumber))}
                </Text>
                <View className="mt-16 px-8">
                  <Text className="text-center text-lg text-gray-600">
                    {resendDisabled
                      ? t("requestNewIn").replace(
                          "{seconds}",
                          String(countdownSeconds)
                        )
                      : t("requestNewNow")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleResendCode}
                  style={[
                    styles.resendButton,
                    resendDisabled && styles.disabledButton,
                  ]}
                  disabled={resendDisabled}
                >
                  <View className="flex w-72 items-center justify-center rounded border border-gray-300 p-2">
                    <Text
                      className={`text-center font-medium ${
                        resendDisabled ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {t("resendCode")}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View className="mt-2 mb-4">
                <Button
                  text={isLoading ? t("verifying") : t("continue")}
                  onPress={handleVerify}
                  style={{ backgroundColor: "#6776cc" }}
                  disabled={isLoading || otp.join("").length !== 6}
                />
              </View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
  },
  resendButton: {
    alignSelf: "center",
    marginTop: 20,
    padding: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  resendText: {
    color: "#5B65E9",
    fontSize: 16,
    fontWeight: "600",
  },
});
