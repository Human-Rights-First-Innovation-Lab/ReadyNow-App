/**
 * Legal Support Setup Screen Tests
 * 
 * Tests the legal support message setup screen including:
 * - Loading existing legal support messages
 * - Creating default legal support message
 * - Message CRUD operations
 * - Form validation
 * - Save and continue functionality
 * - Skip functionality
 * - Error handling
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import LegalSupportSetup from "../legal-support-setup";
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
        title: "Legal Support",
        legalSupport: "Legal Support",
        createMessage: "Create a message for",
        detainedInfo: "This message will be sent if you are detained.",
        recommendIncluding: "We recommend including:",
        legalName: "Your legal name",
        emergencyContact: "Emergency contact information",
        editSample: "Edit the sample message below or create your own.",
        onlySentIf: "These messages will only be sent if you press the alert button.",
        addDifferentMessage: "Add Different Message",
        skip: "Skip",
        saveAndContinue: "Save & Continue",
        deleteMessage: "Delete Message",
        deleteConfirmation: "Are you sure you want to delete this message?",
        errorSaving: "Error saving your message",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock storage utils
const mockLoadEmergencyPlanData = jest.fn();
const mockSaveEmergencyPlanData = jest.fn();

jest.mock("../../../utils/storage-utils", () => ({
  loadEmergencyPlanData: () => mockLoadEmergencyPlanData(),
  saveEmergencyPlanData: (data: any) => mockSaveEmergencyPlanData(data),
}));

// Mock default messages
jest.mock("../../../utils/default-messages", () => ({
  getDefaultMessageByTopic: jest.fn((topic: string, language: string) => {
    return "I have been detained. Please contact my attorney.";
  }),
}));

// Mock modal context
const mockShowConfirm = jest.fn();
const mockShowError = jest.fn();

jest.mock("../../../context/ModalContext", () => ({
  useModal: () => ({
    showConfirm: mockShowConfirm,
    showError: mockShowError,
  }),
}));

// Mock MessageSetup component
jest.mock("../../../components/MessageSetup", () => ({
  MessageSetup: jest.fn((props) => {
    const React = require("react");
    const { View, Text, TouchableOpacity } = require("react-native");
    
    return React.createElement(
      View,
      { testID: `message-${props.messageData.id}` },
      React.createElement(Text, null, props.messageData.message),
      props.showDeleteButton && React.createElement(
        TouchableOpacity,
        {
          testID: `delete-message-${props.messageData.id}`,
          onPress: props.onDelete,
        },
        React.createElement(Text, null, "Delete")
      ),
      React.createElement(
        TouchableOpacity,
        {
          testID: `update-message-${props.messageData.id}`,
          onPress: () => props.onUpdate({
            ...props.messageData,
            message: "Updated message",
          }),
        },
        React.createElement(Text, null, "Update")
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

describe("LegalSupportSetup Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
    mockSaveEmergencyPlanData.mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    
    // Reset modal mocks
    mockShowConfirm.mockReset();
    mockShowError.mockReset();
  });

  describe("Rendering", () => {
    it("renders the screen with title", async () => {
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("Legal Support")).toBeTruthy();
      });
    });

    it("renders instructions", async () => {
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText(/Create a message for/)).toBeTruthy();
        expect(getByText(/This message will be sent if you are detained/)).toBeTruthy();
      });
    });

    it("renders recommended information list", async () => {
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("We recommend including:")).toBeTruthy();
        expect(getByText("• Your legal name")).toBeTruthy();
        expect(getByText("• Emergency contact information")).toBeTruthy();
      });
    });

    it("renders action buttons", async () => {
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
        expect(getByTestId("button-add-different-message")).toBeTruthy();
      });
    });

    it("renders bottom navigation", async () => {
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("bottom-navigation")).toBeTruthy();
      });
    });

    it("shows edit sample instruction", async () => {
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("Edit the sample message below or create your own.")).toBeTruthy();
      });
    });

    it("shows alert button context", async () => {
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("These messages will only be sent if you press the alert button.")).toBeTruthy();
      });
    });
  });

  describe("Loading Data", () => {
    it("loads emergency plan data on mount", async () => {
      render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(mockLoadEmergencyPlanData).toHaveBeenCalled();
      });
    });

    it("creates default message when no legal messages exist", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("I have been detained. Please contact my attorney.")).toBeTruthy();
      });
    });

    it("loads existing legal support messages", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Legal Support",
            message: "Custom legal message",
            contacts: [],
          },
        ],
      });
      
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("Custom legal message")).toBeTruthy();
      });
    });

    it("filters only legal support messages from loaded data", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Legal message", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Pet message", contacts: [] },
          { id: "3", topic: "Other", message: "Other message", contacts: [] },
        ],
      });
      
      const { getByText, queryByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("Legal message")).toBeTruthy();
        expect(queryByText("Pet message")).toBeNull();
        expect(queryByText("Other message")).toBeNull();
      });
    });

    it("creates default message on load error", async () => {
      mockLoadEmergencyPlanData.mockRejectedValue(new Error("Load failed"));
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("I have been detained. Please contact my attorney.")).toBeTruthy();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Message Management", () => {
    it("displays loaded legal support messages", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Message 1", contacts: [] },
          { id: "2", topic: "Legal Support", message: "Message 2", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("message-1")).toBeTruthy();
        expect(getByTestId("message-2")).toBeTruthy();
      });
    });

    it("updates message when changed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Original message", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("update-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("update-message-1"));
      
      await waitFor(() => {
        expect(getByTestId("message-1")).toBeTruthy();
      });
    });

    it('normalizes topic to "Legal Support" when updating', async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Original message", contacts: [] },
        ],
      });
      
      const MessageSetup = require("../../../components/MessageSetup").MessageSetup;
      
      const { getByTestId, getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("Original message")).toBeTruthy();
        expect(getByTestId("update-message-1")).toBeTruthy();
      });
      
      // Simulate updating the message
      fireEvent.press(getByTestId("update-message-1"));
      
      await waitFor(() => {
        // After update, the topic should remain "Legal Support"
        const lastCall = MessageSetup.mock.calls[MessageSetup.mock.calls.length - 1];
        expect(lastCall[0].messageData.topic).toBe("Legal Support");
      });
    });
  });

  describe("Add Another Message", () => {
    it("adds another legal support message", async () => {
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-add-different-message")).toBeTruthy();
      });
      
      const addButton = getByTestId("button-add-different-message");
      fireEvent.press(addButton);
      
      // Should render component successfully
      expect(addButton).toBeTruthy();
    });

    it("creates new message with default content", async () => {
      const MessageSetup = require("../../../components/MessageSetup").MessageSetup;
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-add-different-message")).toBeTruthy();
      });
      
      const initialCallCount = MessageSetup.mock.calls.length;
      
      fireEvent.press(getByTestId("button-add-different-message"));
      
      await waitFor(() => {
        expect(MessageSetup.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("Message Deletion", () => {
    it("shows confirmation when deleting message", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Message 1", contacts: [] },
          { id: "2", topic: "Legal Support", message: "Message 2", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("delete-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("delete-message-1"));
      
      expect(mockShowConfirm).toHaveBeenCalledWith(
        "Delete Message",
        "Are you sure you want to delete this message?",
        expect.any(Function)
      );
    });

    it("deletes message when confirmed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Message 1", contacts: [] },
          { id: "2", topic: "Legal Support", message: "Message 2", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("delete-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("delete-message-1"));
      
      // Get the confirmation callback and call it
      const confirmCallback = mockShowConfirm.mock.calls[0][2];
      confirmCallback();
      
      await waitFor(() => {
        // Message should be removed from state
        expect(getByTestId("message-2")).toBeTruthy();
      });
    });

    it("hides delete button when only one message", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      const MessageSetup = require("../../../components/MessageSetup").MessageSetup;
      
      render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(MessageSetup).toHaveBeenCalled();
      });
      
      const lastCall = MessageSetup.mock.calls[MessageSetup.mock.calls.length - 1];
      expect(lastCall[0].showDeleteButton).toBe(false);
    });

    it("shows delete button when multiple messages", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Message 1", contacts: [] },
          { id: "2", topic: "Legal Support", message: "Message 2", contacts: [] },
        ],
      });
      
      const MessageSetup = require("../../../components/MessageSetup").MessageSetup;
      
      render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(MessageSetup).toHaveBeenCalled();
      });
      
      const calls = MessageSetup.mock.calls;
      expect(calls.some((call: any) => call[0].showDeleteButton === true)).toBe(true);
    });
  });

  describe("Save and Continue", () => {
    it("saves legal support messages and navigates", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Legal Support",
            message: "Legal help needed",
            contacts: [],
          },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockSaveEmergencyPlanData).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/personal-message-setup");
      });
    });

    it("preserves messages from other topics when saving", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "old-legal", topic: "Legal Support", message: "Old legal", contacts: [] },
          { id: "pet-1", topic: "Pet Care", message: "Pet message", contacts: [] },
          { id: "work-1", topic: "Work Absences", message: "Work message", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        const savedData = mockSaveEmergencyPlanData.mock.calls[0][0];
        // Should preserve other topic messages
        expect(savedData.some((msg: any) => msg.id === "pet-1")).toBe(true);
        expect(savedData.some((msg: any) => msg.id === "work-1")).toBe(true);
        // Should have Legal Support messages
        expect(savedData.some((msg: any) => msg.topic === "Legal Support")).toBe(true);
      });
    });

    it("combines legal messages with existing messages from other topics", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Pet Care", message: "Feed cat", contacts: [] },
          { id: "2", topic: "Work Absences", message: "Cannot work", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        const savedData = mockSaveEmergencyPlanData.mock.calls[0][0];
        // Should have at least 3 messages (2 existing + 1 legal)
        expect(savedData.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("shows error on save failure", async () => {
      mockSaveEmergencyPlanData.mockRejectedValue(new Error("Save failed"));
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith("Error saving your message");
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Skip Functionality", () => {
    it("navigates to personal messages info when skip is pressed", async () => {
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-skip"));
      
      expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/personal-message-setup");
    });

    it("does not save messages when skipping", async () => {
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-skip"));
      
      expect(mockSaveEmergencyPlanData).not.toHaveBeenCalled();
    });
  });

  describe("Multiple Messages", () => {
    it("displays multiple legal support messages", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "First message", contacts: [] },
          { id: "2", topic: "Legal Support", message: "Second message", contacts: [] },
          { id: "3", topic: "Legal Support", message: "Third message", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("message-1")).toBeTruthy();
        expect(getByTestId("message-2")).toBeTruthy();
        expect(getByTestId("message-3")).toBeTruthy();
      });
    });

    it("saves all legal support messages", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Message 1", contacts: [] },
          { id: "2", topic: "Legal Support", message: "Message 2", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        const savedData = mockSaveEmergencyPlanData.mock.calls[0][0];
        expect(savedData.filter((msg: any) => msg.topic === "Legal Support").length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("Topic Normalization", () => {
    it('filters messages containing "Legal Support" in topic name', async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "English", contacts: [] },
          { id: "2", topic: "Legal Support - Extended", message: "Extended", contacts: [] },
          { id: "3", topic: "Pet Care", message: "Pet", contacts: [] },
        ],
      });
      
      const { getByText, queryByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        // Should load messages with "Legal Support" in topic
        expect(getByText("English")).toBeTruthy();
        expect(getByText("Extended")).toBeTruthy();
        // Should not load Pet Care
        expect(queryByText("Pet")).toBeNull();
      });
    });

    it('normalizes topic to "Legal Support" on update', async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "English legal", contacts: [] },
        ],
      });
      
      const MessageSetup = require("../../../components/MessageSetup").MessageSetup;
      
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("update-message-1")).toBeTruthy();
      });
      
      // Simulate message update
      fireEvent.press(getByTestId("update-message-1"));
      
      await waitFor(() => {
        // Topic should remain "Legal Support"
        const lastCall = MessageSetup.mock.calls[MessageSetup.mock.calls.length - 1];
        expect(lastCall[0].messageData.topic).toBe("Legal Support");
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles null messages in loaded data", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: null as any });
      
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        // Should create default message
        expect(getByText("I have been detained. Please contact my attorney.")).toBeTruthy();
      });
    });

    it("handles undefined messages in loaded data", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: undefined as any });
      
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        // Should create default message
        expect(getByText("I have been detained. Please contact my attorney.")).toBeTruthy();
      });
    });

    it("handles empty legal messages array", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Pet Care", message: "Pet only", contacts: [] },
        ],
      });
      
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        // Should create default legal message since no legal messages exist
        expect(getByText("I have been detained. Please contact my attorney.")).toBeTruthy();
      });
    });
  });

  describe("Navigation", () => {
    it("navigates to personal-message-setup on save", async () => {
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/personal-message-setup");
      });
    });

    it("navigates to personal-message-setup on skip", async () => {
      const { getByTestId } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-skip"));
      
      expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/personal-message-setup");
    });
  });

  describe("UI Elements", () => {
    it("renders all instructional text elements", async () => {
      const { getByText } = render(<LegalSupportSetup />);
      
      await waitFor(() => {
        expect(getByText("Edit the sample message below or create your own.")).toBeTruthy();
        expect(getByText("These messages will only be sent if you press the alert button.")).toBeTruthy();
      });
    });
  });
});

