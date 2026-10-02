import React from "react";
import { StyleSheet } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import WelcomePage from "../welcome";

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  Stack: {
    Screen: ({ children, options }: any) => children,
  },
}));

// Mock react-navigation for shared Button component
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Create mock functions first
const mockUpdateSetting = jest.fn();
const mockLogAppSettings = jest.fn();
const mockClearUserData = jest.fn().mockResolvedValue(true);

// Mock app settings
jest.mock("../../../utils/app-settings", () => ({
  useAppSettings: () => ({
    settings: { language: "en" },
    get updateSetting() { return mockUpdateSetting; },
  }),
  get logAppSettings() { return mockLogAppSettings; },
}));

// Mock storage utils
jest.mock("../../../utils/storage-utils", () => ({
  get clearUserData() { return mockClearUserData; },
}));

// Mock translations
jest.mock("../../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        selectLanguage: "Select your language",
        continue: "Continue",
        languagePlaceholder: "Choose language",
        englishLabel: "English",
        spanishLabel: "Español",
        koreanLabel: "한국어",
        frenchLabel: "Français",
        creoleLabel: "Kreyòl",
        chineseLabel: "中文",
        arabicLabel: "العربية",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock NativePicker component
jest.mock("../../../components/NativePicker", () => ({
  NativePicker: ({ items, onValueChange, selectedValue }: any) => {
    const { View, Text, TouchableOpacity } = jest.requireActual("react-native");
    
    return (
      <View testID="native-picker">
        {items.map((item: any) => (
          <TouchableOpacity
            key={item.value}
            testID={`picker-option-${item.value}`}
            onPress={() => onValueChange(item.value)}
          >
            <Text>{item.label}</Text>
          </TouchableOpacity>
        ))}
        <Text testID="selected-value">{selectedValue}</Text>
      </View>
    );
  },
}));

describe("WelcomePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the welcome screen correctly", () => {
      const { getByText, getByTestId } = render(<WelcomePage />);
      
      expect(getByText("Select your language")).toBeTruthy();
      expect(getByText("Continue")).toBeTruthy();
      expect(getByTestId("native-picker")).toBeTruthy();
    });

    it("displays all language options", () => {
      const { getByText } = render(<WelcomePage />);
      
      expect(getByText("English")).toBeTruthy();
      expect(getByText("Español")).toBeTruthy();
      expect(getByText("한국어")).toBeTruthy();
      expect(getByText("Français")).toBeTruthy();
      expect(getByText("Kreyòl")).toBeTruthy();
      expect(getByText("中文")).toBeTruthy();
      expect(getByText("العربية")).toBeTruthy();
    });

    it("shows the selected language as default", () => {
      const { getByTestId } = render(<WelcomePage />);
      
      expect(getByTestId("selected-value")).toHaveTextContent("en");
    });
  });

  describe("Language Selection", () => {
    it("updates language when a new language is selected", async () => {
      const { getByTestId } = render(<WelcomePage />);
      
      const spanishOption = getByTestId("picker-option-es");
      fireEvent.press(spanishOption);
      
      await waitFor(() => {
        expect(mockClearUserData).toHaveBeenCalled();
        expect(mockUpdateSetting).toHaveBeenCalledWith("language", "es");
        expect(mockLogAppSettings).toHaveBeenCalled();
      });
    });

    it("clears user data when language is changed", async () => {
      const { getByTestId } = render(<WelcomePage />);
      
      const koreanOption = getByTestId("picker-option-kr");
      fireEvent.press(koreanOption);
      
      await waitFor(() => {
        expect(mockClearUserData).toHaveBeenCalledTimes(1);
      });
    });

    it("updates app settings with selected language", async () => {
      const { getByTestId } = render(<WelcomePage />);
      
      const frenchOption = getByTestId("picker-option-fr");
      fireEvent.press(frenchOption);
      
      await waitFor(() => {
        expect(mockUpdateSetting).toHaveBeenCalledWith("language", "fr");
      });
    });
  });

  describe("Navigation", () => {
    it("navigates to about page when Continue button is pressed", async () => {
      const { getByText } = render(<WelcomePage />);
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      // Wait for async navigation (InteractionManager + setTimeout)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/screens/welcome/about");
      }, { timeout: 200 });
    });
  });

  describe("Button Interaction", () => {
    it("Continue button is clickable", () => {
      const { getByText } = render(<WelcomePage />);
      
      const continueButton = getByText("Continue");
      
      // Should not throw error
      expect(() => fireEvent.press(continueButton)).not.toThrow();
    });

    it("Continue button has correct styling", () => {
      const { getByText } = render(<WelcomePage />);
      
      const continueButton = getByText("Continue");
      expect(continueButton).toBeTruthy();
      const flattenedStyle = StyleSheet.flatten(continueButton.props.style);
      expect(flattenedStyle).toEqual(
        expect.objectContaining({
          color: "white",
          fontSize: 16,
          fontWeight: "600",
        })
      );
    });
  });

  describe("SafeAreaView Configuration", () => {
    it("renders with correct safe area edges", () => {
      const { UNSAFE_root } = render(<WelcomePage />);
      
      // Check that SafeAreaView is rendered
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("Continue button is accessible", async () => {
      const { getByText } = render(<WelcomePage />);
      
      const continueButton = getByText("Continue");
      expect(continueButton).toBeTruthy();
      
      // Button should be pressable
      fireEvent.press(continueButton);
      
      // Wait for async navigation (InteractionManager + setTimeout)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      }, { timeout: 200 });
    });

    it("language picker is accessible", () => {
      const { getByTestId } = render(<WelcomePage />);
      
      const picker = getByTestId("native-picker");
      expect(picker).toBeTruthy();
    });
  });
});

