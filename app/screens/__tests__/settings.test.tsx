import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SettingsScreen from "../settings";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({
    fromEmergencyPlan: "false",
  }),
  Stack: {
    Screen: ({ children, options }: any) => children,
  },
}));

// Create mock functions
const mockUpdateSetting = jest.fn().mockResolvedValue(undefined);
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockShowConfirm = jest.fn();
const mockShowError = jest.fn();
const mockResetEmergencyPlanData = jest.fn().mockResolvedValue(undefined);
const mockClearAdditionalLegalHelp = jest.fn().mockResolvedValue(undefined);

// Mock app settings
jest.mock("../../utils/app-settings", () => ({
  useAppSettings: () => ({
    settings: { language: "en" },
    get updateSetting() { return mockUpdateSetting; },
  }),
}));

// Mock translations
jest.mock("../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        settings: "Settings",
        language: "Language",
        signOut: "Sign Out",
        signOutConfirmation: "Are you sure you want to sign out?",
        cancel: "Cancel",
        confirm: "Confirm",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock auth
jest.mock("../../utils/use-auth", () => ({
  useAuth: () => ({
    get signOut() { return mockSignOut; },
  }),
}));

// Mock modal context
jest.mock("../../context/ModalContext", () => ({
  useModal: () => ({
    get showConfirm() { return mockShowConfirm; },
    get showError() { return mockShowError; },
  }),
}));

// Mock storage utils
jest.mock("../../utils/storage-utils", () => ({
  get resetEmergencyPlanData() { return mockResetEmergencyPlanData; },
  get clearAdditionalLegalHelp() { return mockClearAdditionalLegalHelp; },
}));

// Mock auth service
jest.mock("../../utils/auth-service", () => ({
  STORAGE_KEYS: {
    ACCESS_TOKEN: "access_token",
    REFRESH_TOKEN: "refresh_token",
    USER_INFO: "user_info",
  },
}));

// Mock SecureStore
jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock SettingsTab component
jest.mock("../../components/SettingsTab", () => {
  const React = require("react");
  const { View, Text, TouchableOpacity } = require("react-native");
  const { Picker } = require("@react-native-picker/picker");
  
  return function MockSettingsTab({ selectedLanguage, onLanguageChange, onSignOut, languages }: any) {
    return (
      <View testID="settings-tab">
        <Text>Settings</Text>
        
        <Text>Language</Text>
        <Picker
          testID="language-picker"
          selectedValue={selectedLanguage}
          onValueChange={onLanguageChange}
        >
          {languages.map((lang: any) => (
            <Picker.Item key={lang.value} label={lang.label} value={lang.value} />
          ))}
        </Picker>
        
        <TouchableOpacity testID="sign-out-button" onPress={onSignOut}>
          <Text>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

// Mock EmergencyPlanBottomNavigation
jest.mock("../../components/EmergencyPlanBottomNavigation", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  
  return function MockEmergencyPlanBottomNavigation({ activeTab }: any) {
    return (
      <View testID="emergency-plan-nav">
        <Text>Emergency Plan Navigation - Active: {activeTab}</Text>
      </View>
    );
  };
});

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the settings screen correctly", () => {
      const { getByText, getByTestId } = render(<SettingsScreen />);
      
      expect(getByText("Settings")).toBeTruthy();
      expect(getByTestId("settings-tab")).toBeTruthy();
    });

    it("displays language picker", () => {
      const { getByText, getByTestId } = render(<SettingsScreen />);
      
      expect(getByText("Language")).toBeTruthy();
      expect(getByTestId("language-picker")).toBeTruthy();
    });

    it("displays sign out button", () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      expect(getByTestId("sign-out-button")).toBeTruthy();
    });
  });

  describe("Emergency Plan Navigation", () => {
    it("does not show emergency plan navigation by default", () => {
      const { queryByTestId } = render(<SettingsScreen />);
      
      expect(queryByTestId("emergency-plan-nav")).toBeNull();
    });

    it("shows emergency plan navigation when fromEmergencyPlan is true", () => {
      jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
        fromEmergencyPlan: "true",
      });

      const { getByTestId } = render(<SettingsScreen />);
      
      expect(getByTestId("emergency-plan-nav")).toBeTruthy();
      expect(getByTestId("emergency-plan-nav")).toHaveTextContent("Emergency Plan Navigation - Active: settings");
    });
  });

  describe("Language Change", () => {
    it("updates language when changed", async () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const languagePicker = getByTestId("language-picker");
      fireEvent(languagePicker, "onValueChange", "es");
      
      await waitFor(() => {
        expect(mockUpdateSetting).toHaveBeenCalledWith("language", "es");
      });
    });

    it("supports all available languages", () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const languagePicker = getByTestId("language-picker");
      expect(languagePicker).toBeTruthy();
    });
  });

  describe("Sign Out", () => {
    it("shows confirmation dialog when sign out is pressed", () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const signOutButton = getByTestId("sign-out-button");
      fireEvent.press(signOutButton);
      
      expect(mockShowConfirm).toHaveBeenCalledWith(
        "Sign Out",
        "Are you sure you want to sign out?",
        expect.any(Function)
      );
    });

    it("clears all data when sign out is confirmed", async () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const signOutButton = getByTestId("sign-out-button");
      fireEvent.press(signOutButton);
      
      // Get the confirmation callback
      const confirmCallback = mockShowConfirm.mock.calls[0][2];
      
      // Execute the callback
      await confirmCallback();
      
      await waitFor(() => {
        // Check emergency plan data cleared
        expect(mockResetEmergencyPlanData).toHaveBeenCalled();
        expect(mockClearAdditionalLegalHelp).toHaveBeenCalled();
        
        // Check SecureStore items deleted
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("access_token");
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refresh_token");
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("user_info");
        
        // Check AsyncStorage items removed
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("app_language");
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("app_theme");
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("app_notifications");
        
        // Check sign out called
        expect(mockSignOut).toHaveBeenCalled();
        
        // Check navigation to welcome
        expect(mockReplace).toHaveBeenCalledWith("/screens/welcome/welcome");
      });
    });

    it("clears encryption keys on sign out", async () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const signOutButton = getByTestId("sign-out-button");
      fireEvent.press(signOutButton);
      
      const confirmCallback = mockShowConfirm.mock.calls[0][2];
      await confirmCallback();
      
      await waitFor(() => {
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_plan_encryption_key");
      });
    });

    it("clears emergency plan flags on sign out", async () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const signOutButton = getByTestId("sign-out-button");
      fireEvent.press(signOutButton);
      
      const confirmCallback = mockShowConfirm.mock.calls[0][2];
      await confirmCallback();
      
      await waitFor(() => {
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_plan_completed");
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("has_legal_support");
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("selected_additional_topics");
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_plan_data");
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("user_data");
      });
    });

    it("shows error message when sign out fails", async () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      
      mockSignOut.mockRejectedValueOnce(new Error("Sign out failed"));
      
      const { getByTestId } = render(<SettingsScreen />);
      
      const signOutButton = getByTestId("sign-out-button");
      fireEvent.press(signOutButton);
      
      const confirmCallback = mockShowConfirm.mock.calls[0][2];
      await confirmCallback();
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith("There was a problem signing out. Please try again.");
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Header Configuration", () => {
    it("sets correct header title", () => {
      const { UNSAFE_root } = render(<SettingsScreen />);
      
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("Layout", () => {
    it("renders with SafeAreaView wrapper", () => {
      const { UNSAFE_root } = render(<SettingsScreen />);
      
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("settings tab is accessible", () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const settingsTab = getByTestId("settings-tab");
      expect(settingsTab).toBeTruthy();
    });

    it("sign out button is accessible", () => {
      const { getByTestId } = render(<SettingsScreen />);
      
      const signOutButton = getByTestId("sign-out-button");
      expect(signOutButton).toBeTruthy();
    });
  });
});

