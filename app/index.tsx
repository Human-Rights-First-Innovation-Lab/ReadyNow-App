/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import "../global.css";
import { useAuth } from "./utils/use-auth";
import { STORAGE_KEYS } from "./utils/auth-service";
import {
  loadEmergencyPlanData,
  resetEmergencyPlanData,
  clearAdditionalLegalHelp,
} from "./utils/storage-utils";

export default function Index() {
  const router = useRouter();
  const { isLoading, isLoggedIn, checkAuthStatus } = useAuth();
  const [hasInitialized, setHasInitialized] = React.useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Prevent re-navigation if already initialized
      if (hasInitialized) return;
      try {
        // // ======= DEVELOPMENT RESET ========
        // // Uncomment these lines to reset all stored data when the app reloads
        // // This makes development easier, but should be commented out for production
        // await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, "");
        // await SecureStore.setItemAsync(
        //   STORAGE_KEYS.ONBOARDING_COMPLETED,
        //   "false"
        // );
        // await clearAdditionalLegalHelp();
        // await resetEmergencyPlanData();
        // // ==================================

        // Check authentication status
        await checkAuthStatus();

        // Check if emergency plan creation workflow has been completed
        const emergencyPlanCompleted = await SecureStore.getItemAsync(
          "emergency_plan_completed"
        );

        // Load emergency plan data to check message existence
        const { messages } = await loadEmergencyPlanData();

        // Get onboarding status
        const hasCompletedOnboarding = await SecureStore.getItemAsync(
          STORAGE_KEYS.ONBOARDING_COMPLETED
        );

        // Determine redirection based on auth status and app state
        if (isLoggedIn) {
          // Only go to main if emergency plan workflow is fully completed
          if (hasCompletedOnboarding === "true" && emergencyPlanCompleted === "true") {
            router.replace("main" as any);
          } else if (hasCompletedOnboarding === "true") {
            // User has completed onboarding but not emergency plan workflow
            router.replace("screens/emergency-plan" as any);
          } else {
            // User hasn't completed onboarding
            router.replace("screens/welcome/beforeyoustart1" as any);
          }
        } else {
          // Not logged in, direct to welcome screen
          router.replace("screens/welcome/welcome" as any);
        }
        
        // Mark as initialized to prevent re-navigation
        setHasInitialized(true);
      } catch (error) {
        console.error("Error initializing app:", error);
        // Default fallback - go to welcome screen
        router.replace("screens/welcome/welcome" as any);
        // Mark as initialized even on error to prevent loops
        setHasInitialized(true);
      }
    };

    if (!isLoading && !hasInitialized) {
      void initializeApp();
    }
  }, [isLoading, isLoggedIn, router, checkAuthStatus, hasInitialized]);

  // Show loading indicator while checking user status
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#5B65E9" />
    </View>
  );
}
