import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";

// import { getUserPhoneNumber, setUserPhoneNumber } from "~/utils/user-utils";
import Button from "../../components/Button";
import EmergencyPlanBottomNavigation from "../../components/EmergencyPlanBottomNavigation";
import { useAppSettings } from "../../utils/app-settings";
import { usePageTranslation } from "../../translations";

export default function EmergencyPlanIntro() {
  const router = useRouter();
  const { fromWipe } = useLocalSearchParams();
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("emergency-plan-intro", settings.language);

  const handleNext = () => {
    try {
      router.push("/screens/welcome/beforeyoustart1");
    } catch (error) {
      console.error(
        "Error checking phone number:",
        error instanceof Error ? error.message : String(error)
      );
      // Continue anyway
      router.push("/screens/emergency-plan/legal-support-question");
    }
  };

  // Helper function to handle text with embedded bold parts
  const renderTextWithBoldPart = (text: string, boldPart: string) => {
    const parts = text.split(boldPart);
    return (
      <>
        {parts.map((part, i, arr) => (
          <React.Fragment key={i}>
            {part}
            {i < arr.length - 1 && (
              <Text className="font-bold">{boldPart}</Text>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t("title"),
          headerTitleAlign: "center",
          // headerBackVisible: fromWipe === "true" ? false : true,
          headerBackVisible: false,
          headerLeft: fromWipe === "true" ? () => null : undefined,
          gestureEnabled: fromWipe === "true" ? false : true,
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
        <ScrollView className="px-5" style={{ paddingBottom: 80 }}>
          <Text className="mb-5 px-8 text-center text-3xl font-bold text-black">
            {t("aboutYourPlan")}
          </Text>

          <Text className="mb-8 text-xl leading-6 text-gray-700">
            {renderTextWithBoldPart(t("planDescription"), t("emergencyPlan"))}
          </Text>
          <View className="mb-8">
            <Text className="mb-2 text-xl">{t("step1")}</Text>
            <Text className="mb-2 text-xl">
              {renderTextWithBoldPart(t("step1Description"), t("legalSupport"))}
            </Text>
          </View>
          <View className="mb-8">
            <Text className="mb-2 text-xl">{t("step2")}</Text>
            <Text className="mb-2 text-xl">
              {renderTextWithBoldPart(
                t("step2Description"),
                t("personalSafetyMessage")
              )}
            </Text>
          </View>
          <View className="mb-8">
            <Text className="mb-2 text-xl">{t("step3")}</Text>
            <Text className="mb-2 text-xl">
              {/* Handle step 3 which has multiple bold parts */}
              <Text>
                {t("step3Description")
                  .split(t("additionalCare"))
                  .map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part
                        .split(t("workAbsences"))
                        .map((subpart, j, subArr) => (
                          <React.Fragment key={`${i}-${j}`}>
                            {subpart}
                            {j < subArr.length - 1 && (
                              <Text className="font-bold">
                                {t("workAbsences")}{" "}
                              </Text>
                            )}
                          </React.Fragment>
                        ))}
                      {i < arr.length - 1 && (
                        <Text className="font-bold">
                          {t("additionalCare")}{" "}
                        </Text>
                      )}
                    </React.Fragment>
                  ))}
              </Text>
            </Text>
          </View>
          <View className="mb-8">
            <Button
              text={t("continue")}
              onPress={handleNext}
              style={{ backgroundColor: "#6776cc" }}
            />
          </View>

        </ScrollView>
        <EmergencyPlanBottomNavigation />

        {/* Emergency Plan Bottom Navigation */}
      </View>
    </SafeAreaView>
  );
}
