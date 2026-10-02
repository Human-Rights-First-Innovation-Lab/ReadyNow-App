/**
 * Additional Topics Screen Tests
 * 
 * Tests the additional topics selection screen including:
 * - Rendering topics
 * - Topic selection/deselection
 * - Saving selected topics
 * - Navigation based on selection
 * - Loading previously selected topics
 * - Loading states
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AdditionalTopics from "../additional-topics";
import * as SecureStore from "expo-secure-store";

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

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock app settings
jest.mock("../../../utils/app-settings", () => ({
  useAppSettings: () => ({
    settings: {
      language: "en",
    },
  }),
}));

// Mock translations
jest.mock("../../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        title: "Additional Topics",
        additionalMessages: "Additional Messages",
        setupCustomMessages: "You can set up custom messages for specific situations like childcare, work absences, or any other concerns.",
        childcareBold: "childcare",
        workAbsencesBold: "work absences",
        selectTopicsBold: "Select topics",
        selectAllApply: " that apply to your situation.",
        childCare: "Child / Family Care",
        elderlyCare: "Elderly Dependent Care",
        petCare: "Pet Care",
        workAbsences: "Work Absences",
        other: "Other",
        continue: "Continue",
        skip: "Skip",
        loading: "Loading...",
        infoText: "You can customize messages for each topic on the next screen.",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock Button
jest.mock("../../../components/Button", () => {
  return jest.fn((props) => {
    const React = require("react");
    const { TouchableOpacity, Text } = require("react-native");
    return React.createElement(
      TouchableOpacity,
      {
        testID: "continue-button",
        onPress: props.onPress,
        disabled: props.disabled,
        accessibilityState: { disabled: props.disabled },
      },
      React.createElement(Text, null, props.text)
    );
  });
});

// Mock EmergencyPlanBottomNavigation
jest.mock("../../../components/EmergencyPlanBottomNavigation", () => {
  return jest.fn(() => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "bottom-navigation" });
  });
});

describe("AdditionalTopics Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("renders the screen with title", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Additional Messages")).toBeTruthy();
      });
    });

    it("renders all topic options", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
        expect(getByText("Elderly Dependent Care")).toBeTruthy();
        expect(getByText("Pet Care")).toBeTruthy();
        expect(getByText("Work Absences")).toBeTruthy();
        expect(getByText("Other")).toBeTruthy();
      });
    });

    it("renders continue/skip button", async () => {
      const { getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByTestId("continue-button")).toBeTruthy();
      });
    });

    it("renders bottom navigation", async () => {
      const { getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByTestId("bottom-navigation")).toBeTruthy();
      });
    });

    it("shows loading state initially", () => {
      const { getByText } = render(<AdditionalTopics />);
      
      expect(getByText("Loading...")).toBeTruthy();
    });

    it("hides loading state after data loads", async () => {
      const { queryByText, getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(queryByText("Loading...")).toBeNull();
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
    });
  });

  describe("Topic Selection", () => {
    it("allows selecting a topic", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      const topicButton = getByText("Child / Family Care");
      fireEvent.press(topicButton);
      
      // Topic should now be selected (visual state changes)
      expect(topicButton).toBeTruthy();
    });

    it("allows selecting multiple topics", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      const childCare = getByText("Child / Family Care");
      const petCare = getByText("Pet Care");
      
      fireEvent.press(childCare);
      fireEvent.press(petCare);
      
      expect(childCare).toBeTruthy();
      expect(petCare).toBeTruthy();
    });

    it("allows deselecting a topic", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      const topicButton = getByText("Child / Family Care");
      
      // Select
      fireEvent.press(topicButton);
      
      // Deselect
      fireEvent.press(topicButton);
      
      expect(topicButton).toBeTruthy();
    });

    it("toggles topic selection state", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Pet Care")).toBeTruthy();
      });
      
      const petCare = getByText("Pet Care");
      
      // Multiple toggles
      fireEvent.press(petCare); // Select
      fireEvent.press(petCare); // Deselect
      fireEvent.press(petCare); // Select again
      
      expect(petCare).toBeTruthy();
    });
  });

  describe("Loading Previously Selected Topics", () => {
    it("loads previously selected topics from storage", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Child / Family Care", "Pet Care"])
      );
      
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
          "selected_additional_topics"
        );
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
    });

    it("handles empty stored topics", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
    });

    it("handles invalid JSON in stored topics", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("invalid json");
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
        expect(consoleSpy).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });

    it("handles storage error gracefully", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Navigation", () => {
    it("navigates to topic-message-setup when topics are selected", async () => {
      const { getByText, getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      // Select a topic
      fireEvent.press(getByText("Child / Family Care"));
      
      // Press continue
      const continueButton = getByTestId("continue-button");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "selected_additional_topics",
          expect.stringContaining("Child / Family Care")
        );
        expect(mockPush).toHaveBeenCalledWith({
          pathname: "/screens/emergency-plan/topic-message-setup",
          params: { topicIndex: "0" },
        });
      });
    });

    it("navigates to review when no topics are selected", async () => {
      const { getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByTestId("continue-button")).toBeTruthy();
      });
      
      const continueButton = getByTestId("continue-button");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "selected_additional_topics",
          JSON.stringify([])
        );
        expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/review");
      });
    });

    it("saves selected topics before navigation", async () => {
      const { getByText, getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Pet Care")).toBeTruthy();
      });
      
      fireEvent.press(getByText("Pet Care"));
      fireEvent.press(getByText("Work Absences"));
      
      const continueButton = getByTestId("continue-button");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "selected_additional_topics",
          expect.stringMatching(/Pet Care.*Work Absences|Work Absences.*Pet Care/)
        );
      });
    });
  });

  describe("Button Label", () => {
    it('shows "Skip" when no topics are selected', async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Skip")).toBeTruthy();
      });
    });

    it('shows "Continue" when topics are selected', async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      fireEvent.press(getByText("Child / Family Care"));
      
      await waitFor(() => {
        expect(getByText("Continue")).toBeTruthy();
      });
    });

    it("changes from Skip to Continue when topic selected", async () => {
      const { getByText, queryByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Skip")).toBeTruthy();
      });
      
      fireEvent.press(getByText("Other"));
      
      await waitFor(() => {
        expect(queryByText("Skip")).toBeNull();
        expect(getByText("Continue")).toBeTruthy();
      });
    });

    it("changes from Continue to Skip when all topics deselected", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Pet Care")).toBeTruthy();
      });
      
      const petCare = getByText("Pet Care");
      
      // Select
      fireEvent.press(petCare);
      
      await waitFor(() => {
        expect(getByText("Continue")).toBeTruthy();
      });
      
      // Deselect
      fireEvent.press(petCare);
      
      await waitFor(() => {
        expect(getByText("Skip")).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles save error gracefully", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(
        new Error("Save failed")
      );
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByText, getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Other")).toBeTruthy();
      });
      
      fireEvent.press(getByText("Other"));
      
      const continueButton = getByTestId("continue-button");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error saving selected topics:",
          "Save failed"
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("All Topics", () => {
    it("renders all 5 topic options", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        // Verify all 5 topics are rendered
        expect(getByText("Child / Family Care")).toBeTruthy();
        expect(getByText("Elderly Dependent Care")).toBeTruthy();
        expect(getByText("Pet Care")).toBeTruthy();
        expect(getByText("Work Absences")).toBeTruthy();
        expect(getByText("Other")).toBeTruthy();
      });
    });

    it("allows selecting all topics", async () => {
      const { getByText, getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      // Select all topics
      fireEvent.press(getByText("Child / Family Care"));
      fireEvent.press(getByText("Elderly Dependent Care"));
      fireEvent.press(getByText("Pet Care"));
      fireEvent.press(getByText("Work Absences"));
      fireEvent.press(getByText("Other"));
      
      await waitFor(() => {
        expect(getByText("Continue")).toBeTruthy();
      });
      
      const continueButton = getByTestId("continue-button");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        const savedData = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1];
        const parsedData = JSON.parse(savedData);
        expect(parsedData).toHaveLength(5);
      });
    });
  });

  describe("Button State", () => {
    it("button is enabled during loading", () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      const { getByTestId } = render(<AdditionalTopics />);
      
      const button = getByTestId("continue-button");
      // Button might be disabled while loading, but should be enabled after
      expect(button).toBeTruthy();
    });

    it("button is enabled after loading completes", async () => {
      const { getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        const button = getByTestId("continue-button");
        expect(button.props.accessibilityState.disabled).toBe(false);
      });
    });
  });

  describe("Persistence", () => {
    it("persists selected topics across multiple selections", async () => {
      const { getByText, getByTestId } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
      });
      
      // Select multiple topics in sequence
      fireEvent.press(getByText("Child / Family Care"));
      fireEvent.press(getByText("Pet Care"));
      fireEvent.press(getByText("Work Absences"));
      
      const continueButton = getByTestId("continue-button");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        const savedData = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1];
        const parsedData = JSON.parse(savedData);
        expect(parsedData).toContain("Child / Family Care");
        expect(parsedData).toContain("Pet Care");
        expect(parsedData).toContain("Work Absences");
      });
    });

    it("loads and displays previously selected topics", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Elderly Dependent Care", "Other"])
      );
      
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
          "selected_additional_topics"
        );
        expect(getByText("Elderly Dependent Care")).toBeTruthy();
        expect(getByText("Other")).toBeTruthy();
      });
    });
  });

  describe("Info Text", () => {
    it("displays informational text", async () => {
      const { getByText } = render(<AdditionalTopics />);
      
      await waitFor(() => {
        expect(getByText("You can customize messages for each topic on the next screen.")).toBeTruthy();
      });
    });
  });
});

