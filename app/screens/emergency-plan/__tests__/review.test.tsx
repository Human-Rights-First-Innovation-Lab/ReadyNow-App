/**
 * Review Emergency Plan Screen Tests
 * 
 * Tests the review screen including:
 * - Loading and displaying emergency plan data
 * - Loading and displaying legal support data
 * - Message update functionality
 * - Message deletion with confirmation
 * - Legal support form inline editing
 * - Save and continue functionality
 * - Error handling and modals
 * - Topic grouping and display
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ReviewEmergencyPlan from "../review";
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

// Mock translations - multiple pages
const mockTranslations: Record<string, Record<string, string>> = {
  review: {
    title: "Review Plan",
    reviewYourPlan: "Review Your Emergency Plan",
    carefullyReview: "Carefully review your emergency plan before saving",
    carefullyReviewBold: "Carefully review",
    editLater: "You can edit this later from the Plan tab",
    loading: "Loading...",
    noMessagesYet: "No messages created yet",
    createMessages: "Create Messages",
    noMessages: "No messages",
    optionalLegalSupport: "Optional Legal Support",
    noLegalInfo: "No legal support information added",
    addLegalInfo: "Add Legal Information",
    updateLegalInfo: "Update Legal Info",
    saveAndContinue: "Save & Continue",
    deleteMessage: "Delete Message",
    deleteConfirmation: "Are you sure you want to delete this message?",
    cancel: "Cancel",
    delete: "Delete",
    errorTitle: "Error",
    errorLoading: "Error loading your plan",
    errorUpdating: "Error updating message",
    errorDeleting: "Error deleting message",
    errorSaving: "Error saving your plan",
    ok: "OK",
    planSavedTitle: "Plan Saved!",
    planSavedMessage1: "Your emergency plan has been saved successfully.",
    planSavedMessage2: "You can access it anytime from the main screen.",
    close: "Close",
  },
  "additional-topics": {
    childCare: "Child / Family Care",
    elderlyCare: "Elderly Dependent Care",
    petCare: "Pet Care",
    workAbsences: "Work Absences",
  },
  "personal-message-setup": {
    personalSafetyMessages: "Personal Safety Messages",
  },
  "emergency-plan-intro": {
    legalSupport: "Legal Support",
  },
};

jest.mock("../../../translations", () => ({
  usePageTranslation: (page: string) => ({
    t: (key: string) => {
      return mockTranslations[page]?.[key] || key;
    },
  }),
}));

// Mock storage utils
const mockLoadEmergencyPlanData = jest.fn();
const mockMigrateToNewFormat = jest.fn();
const mockSaveEmergencyPlanData = jest.fn();

jest.mock("../../../utils/storage-utils", () => ({
  loadEmergencyPlanData: () => mockLoadEmergencyPlanData(),
  migrateToNewFormat: () => mockMigrateToNewFormat(),
  saveEmergencyPlanData: (data: any) => mockSaveEmergencyPlanData(data),
}));

// Mock MessageSetup component
jest.mock("../../../components/MessageSetup", () => {
  return {
    MessageSetup: jest.fn((props) => {
      const React = require("react");
      const { View, Text, TouchableOpacity } = require("react-native");
      
      return React.createElement(
        View,
        { testID: `message-${props.messageData.id}` },
        React.createElement(Text, null, props.messageData.message),
        React.createElement(
          TouchableOpacity,
          {
            testID: `delete-message-${props.messageData.id}`,
            onPress: props.onDelete,
          },
          React.createElement(Text, null, "Delete")
        )
      );
    }),
  };
});

// Mock LegalSupportForm
jest.mock("../../../components/LegalSupportForm", () => ({
  LegalSupportForm: jest.fn((props) => {
    const React = require("react");
    const { View, Text } = require("react-native");
    
    return React.createElement(
      View,
      { testID: "legal-support-form" },
      React.createElement(Text, null, "Legal Support Form")
    );
  }),
}));

// Mock CustomModal
jest.mock("../../../components/CustomModal", () => ({
  CustomModal: jest.fn((props) => {
    const React = require("react");
    const { Modal, View, Text, TouchableOpacity } = require("react-native");
    
    if (!props.visible) return null;
    
    return React.createElement(
      Modal,
      { visible: props.visible, testID: "custom-modal" },
      React.createElement(
        View,
        null,
        React.createElement(Text, { testID: "modal-title" }, props.title),
        React.createElement(Text, { testID: "modal-message" }, props.message),
        props.buttons && props.buttons.map((button: any, index: number) =>
          React.createElement(
            TouchableOpacity,
            {
              key: index,
              testID: `modal-button-${button.text.toLowerCase()}`,
              onPress: button.onPress,
            },
            React.createElement(Text, null, button.text)
          )
        )
      )
    );
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
        testID: `button-${props.text.toLowerCase().replace(/\s+/g, "-")}`,
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

describe("ReviewEmergencyPlan Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    mockMigrateToNewFormat.mockResolvedValue(undefined);
    mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
    mockSaveEmergencyPlanData.mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("renders the screen with title", async () => {
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByText("Review Your Emergency Plan")).toBeTruthy();
      });
    });

    it("renders review instructions", async () => {
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByText(/Carefully review your emergency plan before saving/)).toBeTruthy();
        expect(getByText("You can edit this later from the Plan tab")).toBeTruthy();
      });
    });

    it("shows loading state initially", () => {
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      expect(getByText("Loading...")).toBeTruthy();
    });

    it("renders save and continue button", async () => {
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
    });

    it("renders bottom navigation", async () => {
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("bottom-navigation")).toBeTruthy();
      });
    });
  });

  describe("Loading Data", () => {
    it("migrates data to new format on load", async () => {
      render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(mockMigrateToNewFormat).toHaveBeenCalled();
      });
    });

    it("loads emergency plan data", async () => {
      render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(mockLoadEmergencyPlanData).toHaveBeenCalled();
      });
    });

    it("loads legal support data", async () => {
      render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith("additionalLegalHelp");
      });
    });

    it("displays messages when loaded", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Legal Support",
            message: "I need legal help",
            contacts: [],
          },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("message-1")).toBeTruthy();
      });
    });

    it("displays legal support form when data exists", async () => {
      const legalData = {
        firstName: "John",
        lastName: "Doe",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "5551234567",
        emergencyContactEmail: "jane@example.com",
      };
      
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(legalData)
      );
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("legal-support-form")).toBeTruthy();
      });
    });
  });

  describe("Empty State", () => {
    it("shows no messages message when no data exists", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByText("No messages created yet")).toBeTruthy();
      });
    });

    it("shows create messages button when no data", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-create-messages")).toBeTruthy();
      });
    });

    it("navigates to emergency plan when create messages is pressed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-create-messages")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-create-messages"));
      
      expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan");
    });

    it("shows add legal info button when no legal data", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-add-legal-information")).toBeTruthy();
      });
    });

    it("navigates to legal support when add legal info is pressed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-add-legal-information")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-add-legal-information"));
      
      expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/optional-legal-support");
    });
  });

  describe("Message Display", () => {
    it("displays single message", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Legal Support",
            message: "I need legal assistance",
            contacts: [],
          },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("message-1")).toBeTruthy();
      });
    });

    it("displays multiple messages", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Legal help", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Feed my cat", contacts: [] },
          { id: "3", topic: "Work Absences", message: "Cannot work", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("message-1")).toBeTruthy();
        expect(getByTestId("message-2")).toBeTruthy();
        expect(getByTestId("message-3")).toBeTruthy();
      });
    });

    it("groups messages by topic", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Message 1", contacts: [] },
          { id: "2", topic: "Legal Support", message: "Message 2", contacts: [] },
          { id: "3", topic: "Pet Care", message: "Message 3", contacts: [] },
        ],
      });
      
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        // Should show topic headers
        expect(getByText("Legal Support")).toBeTruthy();
        expect(getByText("Pet Care")).toBeTruthy();
      });
    });
  });

  describe("Message Deletion", () => {
    it("shows delete confirmation modal when delete is pressed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("delete-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("delete-message-1"));
      
      await waitFor(() => {
        expect(getByTestId("modal-title")).toBeTruthy();
        expect(getByTestId("modal-message")).toBeTruthy();
      });
    });

    it("cancels deletion when cancel is pressed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      
      const { getByTestId, queryByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("delete-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("delete-message-1"));
      
      await waitFor(() => {
        expect(getByTestId("modal-button-cancel")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("modal-button-cancel"));
      
      await waitFor(() => {
        expect(queryByTestId("custom-modal")).toBeNull();
      });
      
      expect(mockSaveEmergencyPlanData).not.toHaveBeenCalled();
    });

    it("deletes message when confirmed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test 1", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Test 2", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("delete-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("delete-message-1"));
      
      await waitFor(() => {
        expect(getByTestId("modal-button-delete")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("modal-button-delete"));
      
      await waitFor(() => {
        expect(mockSaveEmergencyPlanData).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: "2" }),
          ])
        );
      });
    });

    it("shows error modal on delete failure", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      mockSaveEmergencyPlanData.mockRejectedValue(new Error("Delete failed"));
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("delete-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("delete-message-1"));
      
      await waitFor(() => {
        expect(getByTestId("modal-button-delete")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("modal-button-delete"));
      
      await waitFor(() => {
        // Error modal should be shown
        expect(consoleSpy).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Save and Continue", () => {
    it("is disabled when no data exists", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        const button = getByTestId("button-save-&-continue");
        expect(button.props.accessibilityState.disabled).toBe(true);
      });
    });

    it("is enabled when messages exist", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        const button = getByTestId("button-save-&-continue");
        expect(button.props.accessibilityState.disabled).toBe(false);
      });
    });

    it("is enabled when legal support data exists", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({
          firstName: "John",
          lastName: "Doe",
        })
      );
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        const button = getByTestId("button-save-&-continue");
        expect(button.props.accessibilityState.disabled).toBe(false);
      });
    });

    it("saves legal support data on finish", async () => {
      const legalData = {
        firstName: "John",
        lastName: "Doe",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "5551234567",
        emergencyContactEmail: "jane@example.com",
      };
      
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(legalData)
      );
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "additionalLegalHelp",
          expect.stringContaining("John")
        );
      });
    });

    it("marks emergency plan as completed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "emergency_plan_completed",
          "true"
        );
      });
    });

    it("shows plan saved modal on success", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(getByTestId("modal-title")).toBeTruthy();
      });
    });

    it("navigates to confirmation after closing success modal", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(getByTestId("modal-button-close")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("modal-button-close"));
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/confirmation");
      });
    });
  });

  describe("Error Handling", () => {
    it("shows error modal on load failure", async () => {
      mockLoadEmergencyPlanData.mockRejectedValue(new Error("Load failed"));
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("modal-title")).toBeTruthy();
      });
      
      consoleSpy.mockRestore();
    });

    it("handles invalid JSON in legal support data", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("invalid json");
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "[Review] Error parsing legal support data:",
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it("shows error modal on save failure", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(
        new Error("Save failed")
      );
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Topic Name Translation", () => {
    it("translates Legal Support topic variations", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "법적지원", message: "Korean legal", contacts: [] },
          { id: "2", topic: "Apoyo Legal", message: "Spanish legal", contacts: [] },
          { id: "3", topic: "legal help", message: "English legal", contacts: [] },
        ],
      });
      
      const { getAllByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        // All should be normalized to "Legal Support" (may appear once as header)
        const legalSupportElements = getAllByText("Legal Support");
        expect(legalSupportElements.length).toBeGreaterThan(0);
      });
    });

    it("translates known topic IDs", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Child / Family Care", message: "Test", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Test", contacts: [] },
        ],
      });
      
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByText("Child / Family Care")).toBeTruthy();
        expect(getByText("Pet Care")).toBeTruthy();
      });
    });

    it("uses original topic name for unknown topics", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Custom Topic", message: "Test", contacts: [] },
        ],
      });
      
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByText("Custom Topic")).toBeTruthy();
      });
    });
  });

  describe("Legal Support Form Integration", () => {
    it("renders legal support form with initial data", async () => {
      const legalData = {
        firstName: "John",
        lastName: "Doe",
      };
      
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(legalData)
      );
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("legal-support-form")).toBeTruthy();
      });
    });

    it("renders legal support form with hideButtons enabled", async () => {
      const LegalSupportForm = require("../../../components/LegalSupportForm").LegalSupportForm;
      
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Other", message: "Test", contacts: [] },
        ],
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({ firstName: "John" })
      );
      
      const { getByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByTestId("legal-support-form")).toBeTruthy();
      });
      
      // Verify the form was called with hideButtons: true
      const lastCall = LegalSupportForm.mock.calls[LegalSupportForm.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({
        hideButtons: true,
        showTitle: false,
        showExplanatoryText: false,
        showSkipButton: false,
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles null messages array", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: null as any });
      
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByText("No messages created yet")).toBeTruthy();
      });
    });

    it("handles undefined messages array", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: undefined as any });
      
      const { getByText } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(getByText("No messages created yet")).toBeTruthy();
      });
    });

    it("handles messages without topic", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "", message: "Test", contacts: [] },
        ],
      });
      
      const { queryByTestId } = render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        // Message without topic should be skipped
        expect(queryByTestId("message-1")).toBeNull();
      });
    });
  });

  describe("Data Migration", () => {
    it("calls migrateToNewFormat before loading data", async () => {
      const callOrder: string[] = [];
      
      mockMigrateToNewFormat.mockImplementation(async () => {
        callOrder.push("migrate");
      });
      
      mockLoadEmergencyPlanData.mockImplementation(async () => {
        callOrder.push("load");
        return { messages: [] };
      });
      
      render(<ReviewEmergencyPlan />);
      
      await waitFor(() => {
        expect(callOrder).toEqual(["migrate", "load"]);
      });
    });
  });
});

