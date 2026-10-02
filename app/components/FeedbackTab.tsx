import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";
import { EnhancedTextInput } from "./EnhancedTextInput";

interface FeedbackForm {
  confusing: string;
  setupTrouble: string;
  improvements: string;
  bugReports: string;
}

export default function FeedbackTab() {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("feedback", settings.language);
  const [feedback, setFeedback] = useState<FeedbackForm>({
    confusing: "",
    setupTrouble: "",
    improvements: "",
    bugReports: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedbackToDatabase = async (feedbackData: FeedbackForm) => {
    try {
      // Deliberately no userId and no phoneNumber.
      //
      // The receiving Function discards both before writing to the database -
      // the stored record is timestamp, feedback text, language and createdAt -
      // so sending them identified the user to no purpose. The one place they
      // did land was the Function's request log, on an endpoint that requires
      // no authentication. Feedback about an app used by people facing
      // immigration enforcement should not be attributable to a phone number.
      //
      // apiKey is a marker that this request came from a ReadyNow build, not
      // authentication: the value ships in the bundle and is readable by
      // anyone who unpacks the app. It raises the cost of abusing an otherwise
      // open write endpoint; it does not make one anonymous submission
      // distinguishable from another, which is the point.
      const payload = {
        timestamp: Date.now(),
        feedbackData: feedbackData,
        appLanguage: settings.language,
        apiKey: process.env.EXPO_PUBLIC_TWILIO_API_SECRET,
      };

      const response = await fetch(process.env.EXPO_PUBLIC_MONGODB_API_ENDPOINT!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit feedback");
      }

      return result;
    } catch (error) {
      console.error("Error submitting feedback to database:", error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    // Check if at least one field has content
    const hasContent = Object.values(feedback).some(value => value.trim().length > 0);
    
    if (!hasContent) {
      Alert.alert(t("noFeedbackTitle"), t("noFeedbackMessage"));
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Submit feedback to database
      await submitFeedbackToDatabase(feedback);
      
      // Show success message
      Alert.alert(
        t("thankYouTitle"),
        t("thankYouMessage"),
        [
          {
            text: t("ok"),
            onPress: () => {
              // Clear the form after successful submission
              setFeedback({
                confusing: "",
                setupTrouble: "",
                improvements: "",
                bugReports: "",
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error submitting feedback:", error);
      Alert.alert(t("errorTitle"), t("errorMessage"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFeedback = (field: keyof FeedbackForm, value: string) => {
    setFeedback(prev => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        className="flex-1 bg-white"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="p-4">
        <Text className="mb-6 text-2xl text-center font-bold text-gray-800">
          {t("title")}
        </Text>
        <Text className="mb-6 text-center text-gray-600">
          {t("subtitle")}
        </Text>

        {/* Question 1 */}
        <View className="mb-6">
          <Text className="mb-2 text-base font-semibold text-gray-700">
            {t("question1")}
          </Text>
          <EnhancedTextInput
            className="min-h-[80px] rounded-lg border border-gray-300 bg-gray-50 p-3 text-base"
            multiline
            textAlignVertical="top"
            placeholder={t("placeholder1")}
            value={feedback.confusing}
            onChangeText={(value) => updateFeedback("confusing", value)}
            returnKeyType="done"
            doneButtonText={t("close")}
          />
        </View>

        {/* Question 2 */}
        <View className="mb-6">
          <Text className="mb-2 text-base font-semibold text-gray-700">
            {t("question2")}
          </Text>
          <EnhancedTextInput
            className="min-h-[80px] rounded-lg border border-gray-300 bg-gray-50 p-3 text-base"
            multiline
            textAlignVertical="top"
            placeholder={t("placeholder2")}
            value={feedback.setupTrouble}
            onChangeText={(value) => updateFeedback("setupTrouble", value)}
            returnKeyType="done"
            doneButtonText={t("close")}
          />
        </View>

        {/* Question 3 */}
        <View className="mb-6">
          <Text className="mb-2 text-base font-semibold text-gray-700">
            {t("question3")}
          </Text>
          <EnhancedTextInput
            className="min-h-[80px] rounded-lg border border-gray-300 bg-gray-50 p-3 text-base"
            multiline
            textAlignVertical="top"
            placeholder={t("placeholder3")}
            value={feedback.improvements}
            onChangeText={(value) => updateFeedback("improvements", value)}
            returnKeyType="done"
            doneButtonText={t("close")}
          />
        </View>

        {/* Question 4 */}
        <View className="mb-6">
          <Text className="mb-2 text-base font-semibold text-gray-700">
            {t("question4")}
          </Text>
          <EnhancedTextInput
            className="min-h-[80px] rounded-lg border border-gray-300 bg-gray-50 p-3 text-base"
            multiline
            textAlignVertical="top"
            placeholder={t("placeholder4")}
            value={feedback.bugReports}
            onChangeText={(value) => updateFeedback("bugReports", value)}
            returnKeyType="done"
            doneButtonText={t("close")}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`mt-4 rounded-lg py-4 ${
            isSubmitting
              ? "bg-gray-400"
              : "bg-[#5a69cc]"
          }`}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text className="text-center text-lg font-semibold text-white">
            {isSubmitting ? t("submitting") : t("submitButton")}
          </Text>
        </TouchableOpacity>

        <Text className="mt-4 text-center text-sm text-gray-500">
          {t("footerText")}
        </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 