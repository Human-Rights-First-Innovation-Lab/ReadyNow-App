import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

import type { MessageData } from "./components/MessageSetup";
import type { AppLanguage } from "./utils/app-settings";
import {
  clearAdditionalLegalHelp,
  loadEmergencyPlanData,
  resetEmergencyPlanData,
  saveEmergencyPlanData,
  migrateTopicNames,
} from "./utils/storage-utils";
import { getDefaultMessageByTopic } from "./utils/default-messages";
import BottomNavigation from "./components/BottomNavigation";
import { LegalSupportData } from "./components/LegalSupportForm";
import { useAuth } from "./utils/use-auth";
import { STORAGE_KEYS } from "./utils/auth-service";
import { useAppSettings } from "./utils/app-settings";
import { authenticateWithDeviceLock } from "./utils/encryption-utils";
import {
  registerDevicePushToken,
  disableDevicePushToken,
} from "./utils/notifications";
import { CustomModal } from "./components/CustomModal";
import { usePageTranslation } from "./translations";
import Button from "./components/Button";

// Import tab components
import AlertTab from "./components/AlertTab";
import PlanTab from "./components/PlanTab";
import FAQTab from "./components/FAQTab";
import FeedbackTab from "./components/FeedbackTab";
import SettingsTab from "./components/SettingsTab";
import {
  getCrashReportingConsent,
  setCrashReportingConsent,
} from "./utils/crash-reporting";

type Tab = "alert" | "plan" | "faq" | "feedback" | "settings";

// Default legal support form data
const DEFAULT_LEGAL_SUPPORT_DATA: LegalSupportData = {
  firstName: "",
  middleName: "",
  lastName: "",
  aNumber: "",
  countryOfBirth: "",
  dateOfBirth: "",
  hasImmigrationAttorney: "Unknown",
  immigrationAttorneyNotes: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactEmail: "",
  emergencyContactPhone: "",
  canContactEmergencyContact: false,
  enableLocationSharing: false,
  canHRFContact: false,
};

export default function MainPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isLoggedIn, user, signOut } = useAuth();
  const { settings, updateSetting } = useAppSettings();
  const { t } = usePageTranslation("main", settings.language);
  const [activeTab, setActiveTab] = useState<Tab>("alert");
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(
    settings.language
  );
  const [deviceLockAvailable, setDeviceLockAvailable] = useState(false);
  const [crashReportingEnabled, setCrashReportingEnabled] = useState(
    () => getCrashReportingConsent() === "granted"
  );
  const [isSavingDebounced, setIsSavingDebounced] = useState(false);
  const [legalSupportData, setLegalSupportData] =
    useState<LegalSupportData | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPushNotificationSuccessModal, setShowPushNotificationSuccessModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [showLegalSupportSuccessModal, setShowLegalSupportSuccessModal] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showDemoCompleteScreen, setShowDemoCompleteScreen] = useState(false);

  const languages = [
    { label: "English", value: "en" },
    { label: "Español", value: "es" },
    { label: "한국어", value: "kr" },
    { label: "Français", value: "fr" },
    { label: "Kreyòl", value: "ht" },
    { label: "中文", value: "zh" },
    { label: "العربية", value: "ar" },
    { label: "دری", value: "dr" },
    { label: "پښتو", value: "ps" },
  ];

  const handleToggleCrashReporting = async () => {
    const next = !crashReportingEnabled;

    try {
      await setCrashReportingConsent(next);
      setCrashReportingEnabled(next);
    } catch (error) {
      console.error(
        "Could not update crash reporting preference:",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleLanguageChange = async (value: string) => {
    setSelectedLanguage(value as AppLanguage);
    await updateSetting("language", value as AppLanguage);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("screens/welcome/welcome" as any);
    }
  }, [isLoggedIn, router]);

  // Run topic migration on initial load
  useEffect(() => {
    if (isLoggedIn) {
      // Migrate any translated topic names to standardized English names
      void migrateTopicNames();
    }
  }, [isLoggedIn]);

  // Register for push notifications only once after completing emergency plan
  useEffect(() => {
    const checkAndRegisterNotifications = async () => {
      
      // Only run if user just completed the plan (from route params)
      const planJustCompleted = params.planJustCompleted === "true";
      
      if (!planJustCompleted || !isLoggedIn) {
        return;
      }
      

      // Check if we've already registered for this session
      const alreadyRegistered = await SecureStore.getItemAsync(
        "push_notification_registered"
      );
      if (alreadyRegistered === "true") {
        return;
      }

      const result = await registerDevicePushToken({
        force: false,
        requireBiometric: false,
        language: settings.language,
        userId: user?.userId,
      });

      if (result.outcome === "success") {
        // Mark as registered so we don't do it again
        await SecureStore.setItemAsync("push_notification_registered", "true");
      }
      // Silently fail on error - don't show error modal to avoid disrupting user flow
    };

    void checkAndRegisterNotifications();
  }, [isLoggedIn, params.planJustCompleted, settings.language, user?.userId]);

  // Removed: automatic disable notifications effect (not needed since registration only happens once)

  // Load emergency plan data when the plan tab is active
  useEffect(() => {
    const loadPlanData = async () => {
      if (activeTab === "plan") {
        try {
          setLoading(true);
          const { messages: loadedMessages } = await loadEmergencyPlanData();
          setMessages(loadedMessages);
        } catch (error) {
          console.error(
            "Error loading emergency plan data:",
            error instanceof Error ? error.message : String(error)
          );
        } finally {
          setLoading(false);
        }
      }
    };

    void loadPlanData();
  }, [activeTab]);

  // Check for intended tab after authentication
  useEffect(() => {
    const checkIntendedTab = async () => {
      try {
        const intendedTab = await SecureStore.getItemAsync(
          STORAGE_KEYS.INTENDED_TAB
        );

        if (
          intendedTab &&
          ["alert", "plan", "faq", "feedback", "settings"].includes(intendedTab)
        ) {
          setActiveTab(intendedTab as Tab);

          // Clear the intended tab
          await SecureStore.deleteItemAsync(STORAGE_KEYS.INTENDED_TAB);

          // If we're coming from OTP verification to the plan tab, immediately load the plan data
          if (intendedTab === "plan") {
            try {
              setLoading(true);
              const { messages: loadedMessages } =
                await loadEmergencyPlanData();
              setMessages(loadedMessages);
            } catch (error) {
              console.error(
                "Error loading emergency plan data:",
                error instanceof Error ? error.message : String(error)
              );
            } finally {
              setLoading(false);
            }
          }
        }
      } catch (error) {
        console.error("Error checking intended tab:", error);
      }
    };

    if (isLoggedIn) {
      void checkIntendedTab();
    }
  }, [isLoggedIn]);

  // Check what device lock, if any, we can authenticate against
  useEffect(() => {
    const checkDeviceLockAvailability = async () => {
      try {
        // Any device lock counts - a PIN or pattern is a credential we can
        // check, even with no biometric sensor present.
        const level = await LocalAuthentication.getEnrolledLevelAsync();
        setDeviceLockAvailable(
          level !== LocalAuthentication.SecurityLevel.NONE
        );
      } catch (error) {
        console.error("Error checking device lock availability:", error);
        setDeviceLockAvailable(false);
      }
    };
    void checkDeviceLockAvailability();
  }, []);

  // Check if we should show the demo modal
  useEffect(() => {
    const checkDemoModalStatus = async () => {
      try {
      
        // Check if we've already shown the demo modal
        const demoShown = await SecureStore.getItemAsync("demo_modal_shown");
        
        // Check if we just completed emergency plan creation (from route params)
        const planJustCompleted = params.planJustCompleted === "true";
        
        // Show demo modal if plan was just completed and demo hasn't been shown
        if (planJustCompleted && demoShown !== "true") {
          // Add a small delay to ensure the screen has fully rendered
          setTimeout(() => {
            setShowDemoModal(true);
          }, 500);
        }
      } catch (error) {
        console.error("Error checking demo modal status:", error);
      }
    };
    
    if (isLoggedIn) {
      void checkDemoModalStatus();
    }
  }, [isLoggedIn, params.planJustCompleted]);

  // Set up a useEffect to debounce the saving indicator
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (isSaving) {
      // Only show saving indicator if saving takes longer than 300ms
      timer = setTimeout(() => {
        setIsSavingDebounced(true);
      }, 300);
    } else {
      // Keep the indicator visible briefly after saving completes
      timer = setTimeout(() => {
        setIsSavingDebounced(false);
      }, 500);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [isSaving]);

  // Load legal support data
  useEffect(() => {
    const loadLegalSupportData = async () => {
      if (activeTab === "plan") {
        try {
          const savedData = await SecureStore.getItemAsync(
            "additionalLegalHelp"
          );

          if (savedData) {
            try {
              const parsedData = JSON.parse(savedData) as LegalSupportData;

              setLegalSupportData(parsedData);
            } catch (parseError) {
              console.error("Error parsing legal support data:", parseError);
            }
          } else {
            // Reset legal support data to null if not found
            setLegalSupportData(null);
          }
        } catch (error) {
          console.error("Error loading legal support data:", error);
        }
      }
    };

    void loadLegalSupportData();
  }, [activeTab]);

  // Function to manually check legal support data
  const checkLegalSupportData = async () => {
    try {
      const savedData = await SecureStore.getItemAsync("additionalLegalHelp");

      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);

          setLegalSupportData(parsedData);
          return true;
        } catch (parseError) {
          console.error("Error parsing legal support data:", parseError);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error("Error manually checking legal support data:", error);
      return false;
    }
  };

  // Handle tab change with biometric authentication
  const handleTabChange = async (tab: Tab) => {
    if (tab === "plan") {
      // Always require authentication for the Plan tab for security

      if (deviceLockAvailable) {
        const authenticated = await authenticateWithDeviceLock();
        if (authenticated) {
          setActiveTab(tab);

          await checkLegalSupportData();
        } else {
          setErrorMessage(
            "You must authenticate to access your emergency plan."
          );
          setShowErrorModal(true);
        }
      } else {
        // If biometrics not available, redirect to auth
        await SecureStore.setItemAsync(STORAGE_KEYS.INTENDED_TAB, tab);
        router.push({
          pathname: "/phone-auth" as any,
          params: { returnTo: "plan" },
        });
      }
    } else {
      setActiveTab(tab);
    }
  };

  // Enhanced wipe plan data function
  const handleWipePlanData = () => {
    setShowDeleteModal(true);
  };

  const confirmDeletePlan = async () => {
    try {
      const authenticated = await authenticateWithDeviceLock();
      if (!authenticated) {
        setErrorMessage("You must authenticate to wipe your emergency plan.");
        setShowErrorModal(true);
        setShowDeleteModal(false);
        return;
      }

      await resetEmergencyPlanData();
      await clearAdditionalLegalHelp();
      setShowDeleteModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error(
        "Error wiping emergency plan data:",
        error instanceof Error ? error.message : String(error)
      );
      setErrorMessage("There was an error wiping your emergency plan data.");
      setShowErrorModal(true);
      setShowDeleteModal(false);
    }
  };

  const navigateToEmergencyPlan = () => {
    setShowSuccessModal(false);
    router.replace({
      pathname: "/screens/emergency-plan" as any,
      params: { fromWipe: "true" },
    });
  };

  const handleTryDemo = async () => {
    try {
      // Mark that we've shown the demo modal
      await SecureStore.setItemAsync("demo_modal_shown", "true");
      // Close the demo modal
      setShowDemoModal(false);
      // Enable demo mode
      setIsDemoMode(true);
      // Switch to alert tab
      setActiveTab("alert");
    } catch (error) {
      console.error("Error starting demo mode:", error);
      setShowDemoModal(false);
    }
  };

  const handleSkipDemo = async () => {
    try {
      // Mark that we've shown the demo modal
      await SecureStore.setItemAsync("demo_modal_shown", "true");
      setShowDemoModal(false);
    } catch (error) {
      console.error("Error saving demo modal status:", error);
      setShowDemoModal(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    try {
      // Clear emergency plan data
      await resetEmergencyPlanData();
      await clearAdditionalLegalHelp();

      // Disable push notifications for this device
      await disableDevicePushToken({
        requireBiometric: false,
        userId: user?.userId,
      });

      // Clear auth tokens and user info
      for (const key of Object.values(STORAGE_KEYS)) {
        await SecureStore.deleteItemAsync(key);
      }

      // Clear app settings using AsyncStorage
      const appSettingsKeys = [
        "app_language",
        "app_theme",
        "app_notifications",
      ];
      for (const key of appSettingsKeys) {
        await AsyncStorage.removeItem(key);
      }

      // Clear encryption keys
      await SecureStore.deleteItemAsync("emergency_plan_encryption_key");
      
      // Clear demo modal shown flag
      await SecureStore.deleteItemAsync("demo_modal_shown");

      // Sign out user
      await signOut();

      setShowSignOutModal(false);
      router.replace("screens/welcome/welcome" as any);
    } catch (error) {
      setErrorMessage("There was a problem signing out. Please try again.");
      setShowErrorModal(true);
      setShowSignOutModal(false);
    }
  };

  const handleAlertPress = () => {
    // In demo mode, show demo complete screen instead of sending real alerts
    if (isDemoMode) {
      // Defer state update to avoid updating during render
      setTimeout(() => {
        setShowDemoCompleteScreen(true);
      }, 0);
    }
    // Real alert logic is handled inside AlertButton component
  };

  const handleExitDemoMode = () => {
    setIsDemoMode(false);
    setShowDemoCompleteScreen(false);
  };

  const handleTryDemoAgain = () => {
    setShowDemoCompleteScreen(false);
    // Stay in demo mode, user can practice again
  };

  const handleTryDemoFromSettings = () => {
    setIsDemoMode(true);
    setActiveTab("alert");
  };

  const handleEnablePushNotifications = useCallback(async () => {
    try {
      const result = await registerDevicePushToken({
        force: true,
        requireBiometric: false,
        language: settings.language,
        userId: user?.userId,
      });

      if (result.outcome === "success") {
        await SecureStore.setItemAsync("push_notification_registered", "true");
        // Use dedicated push notification success modal
        setShowPushNotificationSuccessModal(true);
      } else if (result.reason === "permission-denied") {
        setErrorMessage(t("notificationsPermissionDenied"));
        setShowErrorModal(true);
      } else {
        setErrorMessage(t("notificationEnableFailed"));
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Error enabling push notifications:", error);
      setErrorMessage(t("notificationEnableFailed"));
      setShowErrorModal(true);
    }
  }, [settings.language, t, user?.userId]);

  const handleSavePress = async () => {
    try {
      setIsSaving(true);
      // Save the current messages state
      await saveEmergencyPlanData({ messages });
    } catch (error) {
      setErrorMessage(
        "There was an error saving your emergency plan. Please try again."
      );
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMessageUpdate = (updatedMessage: MessageData) => {
    // Find the original message to preserve the topic if needed
    const originalMessage = messages.find((m) => m.id === updatedMessage.id);

    // We should preserve the original topic to maintain consistency
    let finalMessage = updatedMessage;

    if (originalMessage && originalMessage.topic !== updatedMessage.topic) {
      // Keep the original topic while updating other fields
      finalMessage = {
        ...updatedMessage,
        topic: originalMessage.topic,
      };
    }

    // Update the message in the messages array, ensuring topic consistency
    const updatedMessages = messages.map((message) =>
      message.id === finalMessage.id ? finalMessage : message
    );
    setMessages(updatedMessages);

    // Automatically save changes
    setIsSaving(true);
    saveEmergencyPlanData({ messages: updatedMessages })
      .catch((error) => {
        setErrorMessage(
          "There was an error saving your changes. Please try again."
        );
        setShowErrorModal(true);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleDeleteMessage = (id: string) => {
    setMessageToDelete(id);
    setShowDeleteMessageModal(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      setIsSaving(true);

      // Create a new array without the message to delete
      const updatedMessages = messages.filter(
        (msg) => msg.id !== messageToDelete
      );

      // Update state first
      setMessages(updatedMessages);

      // Then save to storage with the updated array
      await saveEmergencyPlanData({ messages: updatedMessages });
    } catch (error) {
      setErrorMessage(
        "There was an error deleting your message. Please try again."
      );
      setShowErrorModal(true);

      // Reload the messages from storage to ensure UI consistency
      try {
        const { messages: loadedMessages } = await loadEmergencyPlanData();
        setMessages(loadedMessages);
      } catch (loadError) {
        // Error already handled by the outer catch block
      }
    } finally {
      setIsSaving(false);
      setShowDeleteMessageModal(false);
      setMessageToDelete(null);
    }
  };

  const handleAddMessage = async (topic: string) => {
    setIsSaving(true);
    try {
      let { messages: existingMessages } = await loadEmergencyPlanData();

      const defaultMessage = getDefaultMessageByTopic(topic, settings.language);
      const newMessage: MessageData = {
        id: Date.now().toString(),
        topic,
        message: defaultMessage,
        contacts: [],
      };

      existingMessages = [...existingMessages, newMessage];
      await saveEmergencyPlanData(existingMessages);
      setMessages(existingMessages);
    } catch (error) {
      console.error(
        "Error saving emergency plan data:",
        error instanceof Error ? error.message : String(error)
      );
      setErrorMessage(t("error"));
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLegalSupport = async (formData: LegalSupportData) => {
    try {
      setIsSaving(true);

      // Save the data
      await SecureStore.setItemAsync(
        "additionalLegalHelp",
        JSON.stringify(formData)
      );

      // Verify the data was saved properly
      const verifyData = await SecureStore.getItemAsync("additionalLegalHelp");
      if (!verifyData) {
        throw new Error(
          "Failed to verify legal support data - not found after saving"
        );
      }

      // Update state
      setLegalSupportData(formData);
      setShowLegalSupportSuccessModal(true);
    } catch (error) {
      setErrorMessage("There was an error saving your information");
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelLegalSupport = async () => {
    try {
      // Clear both saved and draft legal support data
      await SecureStore.deleteItemAsync("additionalLegalHelp");
      await SecureStore.deleteItemAsync("additionalLegalHelp_draft");
      
      // Update local state
      setLegalSupportData(null);
    } catch (error) {
      setErrorMessage("There was an error removing legal support data");
      setShowErrorModal(true);
    }
  };

  // Use useMemo for tab titles to avoid dependency issues with translations
  const getHeaderTitle = useMemo(() => {
    return () => {
      switch (activeTab) {
        case "alert":
          return t("readyNow");
        case "plan":
          return t("emergencyPlan");
        case "faq":
          return t("faq");
        case "feedback":
          return t("feedback");
        case "settings":
          return t("settings");
        default:
          return "ReadyNow";
      }
    };
  }, [activeTab, t]);

  // Header configuration based on active tab
  const getHeaderOptions = () => {
    const baseOptions = {
      title: getHeaderTitle(),
      headerTitleAlign: "center" as const,
      headerRight: renderHeaderRight,
      headerBackVisible: false, // Hide default back button
      headerLeft: undefined, // No custom left header component
      headerStyle: {
        backgroundColor: "#f0f0f2",
      },
      headerTintColor: "#5a69cc",
      headerTitleStyle: {
        fontWeight: "500" as const,
      },
    };

    // All tabs use the same base header configuration without back buttons
    return baseOptions;
  };

  const renderHeaderRight = () => {
    if (activeTab === "plan") {
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {isSavingDebounced ? (
            <Text
              style={{
                color: "#007AFF",
                fontSize: 14,
                fontWeight: "500",
                marginRight: 15,
                opacity: 0.8,
              }}
            >
              {t("saving")}
            </Text>
          ) : (
            <Text
              style={{
                color: "#4CAF50",
                fontSize: 14,
                fontWeight: "500",
                marginRight: 15,
                opacity: 0,
              }}
            >
              {t("saved")}
            </Text>
          )}
        </View>
      );
    }
    return null;
  };

  const renderContent = () => {
    switch (activeTab) {
      case "alert":
        return <AlertTab onAlertPress={handleAlertPress} isDemoMode={isDemoMode} />;
      case "plan":
        return (
          <PlanTab
            messages={messages}
            loading={loading}
            legalSupportData={legalSupportData}
            isSavingDebounced={isSavingDebounced}
            onUpdateMessage={handleMessageUpdate}
            onDeleteMessage={handleDeleteMessage}
            onAddMessage={handleAddMessage}
            onWipePlanData={handleWipePlanData}
            onSaveLegalSupport={handleSaveLegalSupport}
            onCancelLegalSupport={handleCancelLegalSupport}
            defaultLegalSupportData={DEFAULT_LEGAL_SUPPORT_DATA}
          />
        );
      case "faq":
        return <FAQTab />;
      case "feedback":
        return <FeedbackTab />;
      case "settings":
        return (
          <SettingsTab
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
            onSignOut={handleSignOut}
            onTryDemo={handleTryDemoFromSettings}
            onEnablePushNotifications={handleEnablePushNotifications}
            showPushNotificationsButton={true}
            languages={languages}
            crashReportingEnabled={crashReportingEnabled}
            onToggleCrashReporting={handleToggleCrashReporting}
          />
        );
      default:
        return null;
    }
  };

  // If demo complete screen is showing, render that instead of main content
  if (showDemoCompleteScreen) {
    return (
      <SafeAreaView className="flex-1">
        <Stack.Screen 
          options={{
            headerShown: false
          }} 
        />
        <View className="flex-1 justify-start mt-8 px-6">
          <View className="mb-8">
            <Text className="text-2xl font-bold text-center text-gray-800 mb-4">
              {t("demoCompleteTitle")}
            </Text>
            <Text className="text-base text-gray-800 font-semibold mb-3">
              {t("demoCompleteContentTitle")}
            </Text>
            <Text className="text-base text-gray-600 mb-2">
              {t("demoCompleteContent1")}
            </Text>
            <Text className="text-base text-gray-600 mb-2">
              {t("demoCompleteContent2")}
            </Text>
            <Text className="text-base text-gray-600">
              {t("demoCompleteContent3")}
            </Text>
          </View>
          <View
        className="border border-gray-200 mb-6"
      >
          <View className="flex-row items-center justify-center mt-4">
            <Text
              className={"text-center text-sm font-bold text-gray-600 mr-1"}
            >
             {t("demoCompleteReminder")}
            </Text>
     
          </View>

          <Text
            className="text-center text-sm my-4 text-gray-600"
          >
            {t("demoCompleteReminderText")}
          </Text>
          </View>
          
          <View>
            <Button
              text={t("gotIt")}
              onPress={handleExitDemoMode}
              style={{ backgroundColor: "#34C759", marginBottom: 12 }}
            />
            <Button
              text={t("tryAgain")}
              onPress={handleTryDemoAgain}
              style={{ backgroundColor: "#f0f0f2" }}
              textStyle={{ color: "#60646c" }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={getHeaderOptions()} />
      <View className="flex-1 bg-background">
        {renderContent()}

        {/* Delete Confirmation Modal */}
        <CustomModal
          visible={showDeleteModal}
          title={t("deleteEmergencyPlan")}
          message={t("deleteConfirmation")}
          onClose={() => setShowDeleteModal(false)}
          buttons={[
            {
              text: t("cancel"),
              onPress: () => setShowDeleteModal(false),
              type: "secondary",
            },
            {
              text: t("yesDelete"),
              onPress: confirmDeletePlan,
              type: "danger",
            },
          ]}
        />

        {/* Success Modal - Plan Deleted */}
        <CustomModal
          visible={showSuccessModal}
          title={t("emergencyPlanDeleted")}
          message={t("planDeletedMessage")}
          onClose={() => setShowSuccessModal(false)}
          buttons={[
            {
              text: t("createEmergencyPlan"),
              onPress: navigateToEmergencyPlan,
              type: "primary",
            },
          ]}
        />

        {/* Push Notification Success Modal */}
        <CustomModal
          visible={showPushNotificationSuccessModal}
          title={t("success")}
          message={t("notificationEnabledSuccess")}
          onClose={() => setShowPushNotificationSuccessModal(false)}
          buttons={[
            {
              text: t("ok"),
              onPress: () => setShowPushNotificationSuccessModal(false),
              type: "primary",
            },
          ]}
        />

        {/* Sign Out Confirmation Modal */}
        <CustomModal
          visible={showSignOutModal}
          title={t("signOut")}
          message={t("signOutConfirmation")}
          onClose={() => setShowSignOutModal(false)}
          buttons={[
            {
              text: t("cancel"),
              onPress: () => setShowSignOutModal(false),
              type: "secondary",
            },
            {
              text: t("signOut"),
              onPress: confirmSignOut,
              type: "danger",
            },
          ]}
        />

        {/* Delete Message Modal */}
        <CustomModal
          visible={showDeleteMessageModal}
          title={t("deleteMessage")}
          message={t("deleteMessageConfirmation")}
          onClose={() => setShowDeleteMessageModal(false)}
          buttons={[
            {
              text: t("cancel"),
              onPress: () => setShowDeleteMessageModal(false),
              type: "secondary",
            },
            {
              text: t("delete"),
              onPress: confirmDeleteMessage,
              type: "danger",
            },
          ]}
        />

        {/* Legal Support Success Modal */}
        <CustomModal
          visible={showLegalSupportSuccessModal}
          title={t("success")}
          message={t("legalSupportSaved")}
          onClose={() => setShowLegalSupportSuccessModal(false)}
          buttons={[
            {
              text: t("ok"),
              onPress: () => setShowLegalSupportSuccessModal(false),
              type: "primary",
            },
          ]}
        />

        {/* Error Modal */}
        <CustomModal
          visible={showErrorModal}
          title={t("error")}
          message={errorMessage}
          onClose={() => setShowErrorModal(false)}
          buttons={[
            {
              text: t("ok"),
              onPress: () => setShowErrorModal(false),
              type: "primary",
            },
          ]}
        />

        {/* Demo Modal */}
        <CustomModal
          visible={showDemoModal}
          title={t("demoModalTitle")}
          message={t("demoModalContent")}
          onClose={() => {}} // No close button
          buttons={[
            {
              text: t("tryDemo"),
              onPress: handleTryDemo,
              type: "primary",
            },
          ]}
          footer={
            <TouchableOpacity onPress={handleSkipDemo} className="mt-2 p-2">
              <Text className="text-center text-base text-gray-600 underline">
                {t("skipForNow")}
              </Text>
            </TouchableOpacity>
          }
        />

        {/* Bottom Navigation */}
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      </View>
    </SafeAreaView>
  );
}
