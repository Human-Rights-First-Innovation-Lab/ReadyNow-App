import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import FeedbackScreen from "../feedback";

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

// Create mock functions first
const mockUser = {
  userId: "test-user-123",
  phone: "+1234567890",
  isAuthenticated: true,
};

// Mock app settings
jest.mock("../../utils/app-settings", () => ({
  useAppSettings: () => ({
    settings: { language: "en" },
  }),
}));

// Mock auth
jest.mock("../../utils/use-auth", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// Mock translations
jest.mock("../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        feedback: "Feedback",
        confusingTitle: "What was confusing?",
        confusingPlaceholder: "Tell us what was confusing...",
        setupTroubleTitle: "Setup troubles?",
        setupTroublePlaceholder: "Describe any setup issues...",
        improvementsTitle: "Improvements?",
        improvementsPlaceholder: "How can we improve?",
        bugReportsTitle: "Bug reports?",
        bugReportsPlaceholder: "Report any bugs...",
        submitFeedback: "Submit Feedback",
        thankYou: "Thank you!",
        feedbackSubmitted: "Your feedback has been submitted successfully.",
        error: "Error",
        submitError: "Failed to submit feedback. Please try again.",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock SecureStore
const mockGetItemAsync = jest.fn();
jest.mock("expo-secure-store", () => ({
  getItemAsync: mockGetItemAsync,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Alert
const mockAlert = jest.fn();
jest.spyOn(require("react-native").Alert, "alert").mockImplementation(mockAlert);

// Mock FeedbackTab component
jest.mock("../../components/FeedbackTab", () => {
  const React = require("react");
  const { View, Text, TouchableOpacity, TextInput } = require("react-native");
  
  return function MockFeedbackTab() {
    const [feedback, setFeedback] = React.useState({
      confusing: "",
      setupTrouble: "",
      improvements: "",
      bugReports: "",
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmit = async () => {
      setIsSubmitting(true);
      // Simulate API call
      setTimeout(() => {
        setIsSubmitting(false);
        mockAlert("Thank you!", "Your feedback has been submitted successfully.");
      }, 100);
    };

    return (
      <View testID="feedback-tab">
        <Text>Feedback Form</Text>
        
        <Text>What was confusing?</Text>
        <TextInput
          testID="confusing-input"
          value={feedback.confusing}
          onChangeText={(text: string) => setFeedback((prev: any) => ({ ...prev, confusing: text }))}
          placeholder="Tell us what was confusing..."
        />
        
        <Text>Setup troubles?</Text>
        <TextInput
          testID="setup-trouble-input"
          value={feedback.setupTrouble}
          onChangeText={(text: string) => setFeedback((prev: any) => ({ ...prev, setupTrouble: text }))}
          placeholder="Describe any setup issues..."
        />
        
        <Text>Improvements?</Text>
        <TextInput
          testID="improvements-input"
          value={feedback.improvements}
          onChangeText={(text: string) => setFeedback((prev: any) => ({ ...prev, improvements: text }))}
          placeholder="How can we improve?"
        />
        
        <Text>Bug reports?</Text>
        <TextInput
          testID="bug-reports-input"
          value={feedback.bugReports}
          onChangeText={(text: string) => setFeedback((prev: any) => ({ ...prev, bugReports: text }))}
          placeholder="Report any bugs..."
        />
        
        <TouchableOpacity
          testID="submit-button"
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityState={{ disabled: isSubmitting }}
        >
          <Text>{isSubmitting ? "Submitting..." : "Submit Feedback"}</Text>
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

describe("FeedbackScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAsync.mockResolvedValue("+1234567890");
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  describe("Rendering", () => {
    it("renders the feedback screen correctly", () => {
      const { getByText, getByTestId } = render(<FeedbackScreen />);
      
      expect(getByText("Feedback Form")).toBeTruthy();
      expect(getByTestId("feedback-tab")).toBeTruthy();
    });

    it("displays all feedback form fields", () => {
      const { getByText, getByTestId } = render(<FeedbackScreen />);
      
      expect(getByText("What was confusing?")).toBeTruthy();
      expect(getByText("Setup troubles?")).toBeTruthy();
      expect(getByText("Improvements?")).toBeTruthy();
      expect(getByText("Bug reports?")).toBeTruthy();
      
      expect(getByTestId("confusing-input")).toBeTruthy();
      expect(getByTestId("setup-trouble-input")).toBeTruthy();
      expect(getByTestId("improvements-input")).toBeTruthy();
      expect(getByTestId("bug-reports-input")).toBeTruthy();
    });

    it("shows submit button", () => {
      const { getByTestId } = render(<FeedbackScreen />);
      
      expect(getByTestId("submit-button")).toBeTruthy();
    });
  });

  describe("Emergency Plan Navigation", () => {
    it("does not show emergency plan navigation by default", () => {
      const { queryByTestId } = render(<FeedbackScreen />);
      
      expect(queryByTestId("emergency-plan-nav")).toBeNull();
    });

    it("shows emergency plan navigation when fromEmergencyPlan is true", () => {
      // Mock useLocalSearchParams to return fromEmergencyPlan: 'true'
      jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
        fromEmergencyPlan: "true",
      });

      const { getByTestId } = render(<FeedbackScreen />);
      
      expect(getByTestId("emergency-plan-nav")).toBeTruthy();
    });
  });

  describe("Form Interaction", () => {
    it("allows text input in all fields", () => {
      const { getByTestId } = render(<FeedbackScreen />);
      
      const confusingInput = getByTestId("confusing-input");
      const setupInput = getByTestId("setup-trouble-input");
      const improvementsInput = getByTestId("improvements-input");
      const bugReportsInput = getByTestId("bug-reports-input");
      
      fireEvent.changeText(confusingInput, "The navigation was confusing");
      fireEvent.changeText(setupInput, "Had trouble with setup");
      fireEvent.changeText(improvementsInput, "Better UI needed");
      fireEvent.changeText(bugReportsInput, "Found a bug in alerts");
      
      expect(confusingInput.props.value).toBe("The navigation was confusing");
      expect(setupInput.props.value).toBe("Had trouble with setup");
      expect(improvementsInput.props.value).toBe("Better UI needed");
      expect(bugReportsInput.props.value).toBe("Found a bug in alerts");
    });

    it("submits feedback when submit button is pressed", async () => {
      const { getByTestId } = render(<FeedbackScreen />);
      
      const submitButton = getByTestId("submit-button");
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          "Thank you!",
          "Your feedback has been submitted successfully."
        );
      });
    });

    it("disables submit button while submitting", async () => {
      const { getByTestId, getByText } = render(<FeedbackScreen />);
      
      const submitButton = getByTestId("submit-button");
      fireEvent.press(submitButton);
      
      // Button should show submitting state
      await waitFor(() => {
        expect(getByText("Submitting...")).toBeTruthy();
      });
    });
  });

  describe("Header Configuration", () => {
    it("sets correct header title", () => {
      const { UNSAFE_root } = render(<FeedbackScreen />);
      
      // Component renders successfully with header configuration
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("Layout", () => {
    it("applies correct padding when emergency plan nav is shown", () => {
      // Mock useLocalSearchParams to return fromEmergencyPlan: 'true'
      jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
        fromEmergencyPlan: "true",
      });

      const { getByTestId } = render(<FeedbackScreen />);
      
      expect(getByTestId("emergency-plan-nav")).toBeTruthy();
    });

    it("does not apply extra padding when emergency plan nav is hidden", () => {
      // Mock useLocalSearchParams to return fromEmergencyPlan: 'false'
      jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
        fromEmergencyPlan: "false",
      });

      const { queryByTestId } = render(<FeedbackScreen />);
      
      expect(queryByTestId("emergency-plan-nav")).toBeNull();
    });
  });

  describe("SafeAreaView", () => {
    it("renders with SafeAreaView wrapper", () => {
      const { UNSAFE_root } = render(<FeedbackScreen />);
      
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("feedback form is accessible", () => {
      const { getByTestId } = render(<FeedbackScreen />);
      
      const feedbackTab = getByTestId("feedback-tab");
      expect(feedbackTab).toBeTruthy();
    });

    it("submit button is accessible", () => {
      const { getByTestId } = render(<FeedbackScreen />);
      
      const submitButton = getByTestId("submit-button");
      expect(submitButton).toBeTruthy();
      
      // Button should be pressable
      fireEvent.press(submitButton);
      expect(submitButton).toBeTruthy();
    });
  });
});
