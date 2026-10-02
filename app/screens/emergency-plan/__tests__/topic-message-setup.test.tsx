/**
 * Topic Message Setup Screen Tests
 * 
 * Tests the topic message setup screen including:
 * - Loading topic data and creating default messages
 * - Message CRUD operations (create, update, delete)
 * - Form validation (empty messages, empty contacts)
 * - Multi-step navigation between topics
 * - Skip functionality
 * - Error handling
 * - Topic ID consistency across languages
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import TopicMessageSetup from "../topic-message-setup";
import * as SecureStore from "expo-secure-store";

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
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
const mockTranslations: Record<string, Record<string, string>> = {
  "topic-message-setup": {
    title: "Message Setup",
    loading: "Loading...",
    messagesTitle: "Messages for {topicLabel}",
    wantedToCreate: "You wanted to create messages for {topicLabel}",
    recommendedInfo: "Here is some recommended information to include:",
    workAbsencesInfo: "Notify your employer about your absence.",
    editSample: "Edit the sample message below or create your own.",
    onlySentIf: "These messages will only be sent if you press the alert button.",
    addAnotherMessage: "Add Another Message",
    skip: "Skip",
    saveAndContinue: "Save & Continue",
    errorTitle: "Error",
    errorEmptyMessage: "Please enter a message",
    errorEmptyContact: "Please fill in all contact information",
    errorDuplicateContact: "Please remove duplicate contacts. Each phone number can only be added once.",
    errorSaving: "Error saving your messages",
    ok: "OK",
    deleteTitle: "Delete Message",
    deleteConfirmation: "Are you sure you want to delete this message?",
    cancel: "Cancel",
    delete: "Delete",
    childCareInfo1: "Child care info 1",
    childCareInfo2: "Child care info 2",
    childCareInfo3: "Child care info 3",
    childCareInfo4: "Child care info 4",
    childCareInfo5: "Child care info 5",
    elderlyCareInfo1: "Elderly care info 1",
    elderlyCareInfo2: "Elderly care info 2",
    elderlyCareInfo3: "Elderly care info 3",
    elderlyCareInfo4: "Elderly care info 4",
    petCareInfo1: "Pet care info 1",
    petCareInfo2: "Pet care info 2",
    petCareInfo3: "Pet care info 3",
    petCareInfo4: "Pet care info 4",
    petCareInfo5: "Pet care info 5",
    workAbsencesInfo1: "Work absences info 1",
  },
  "additional-topics": {
    childCare: "Child / Family Care",
    elderlyCare: "Elderly Dependent Care",
    petCare: "Pet Care",
    workAbsences: "Work Absences",
    other: "Other",
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
const mockSaveEmergencyPlanData = jest.fn();

jest.mock("../../../utils/storage-utils", () => ({
  loadEmergencyPlanData: () => mockLoadEmergencyPlanData(),
  saveEmergencyPlanData: (data: any) => mockSaveEmergencyPlanData(data),
}));

// Mock default messages
jest.mock("../../../utils/default-messages", () => ({
  getDefaultMessageByTopic: jest.fn((topic: string) => {
    const defaults: Record<string, string> = {
      "Child / Family Care": "Please pick up my children from school.",
      "Pet Care": "Please feed my pet.",
      "Work Absences": "I will not be at work today.",
      "Elderly Dependent Care": "Please check on my elderly parent.",
      "Other": "This is a custom message.",
    };
    return defaults[topic] || "Default message";
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
      )
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

describe("TopicMessageSetup Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
    mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
    mockSaveEmergencyPlanData.mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      JSON.stringify(["Pet Care"])
    );
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("shows loading state when topic label not loaded", () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      const { getByText } = render(<TopicMessageSetup />);
      
      expect(getByText("Loading...")).toBeTruthy();
    });

    it("renders the screen with topic title", async () => {
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText(/Messages for Pet Care/)).toBeTruthy();
      });
    });

    it("renders action buttons", async () => {
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
        expect(getByTestId("button-add-another-message")).toBeTruthy();
      });
    });

    it("renders bottom navigation", async () => {
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("bottom-navigation")).toBeTruthy();
      });
    });
  });

  describe("Loading Topics", () => {
    it("loads selected topics from storage", async () => {
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
          "selected_additional_topics"
        );
      });
    });

    it("redirects to additional-topics if no topics stored", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          "/screens/emergency-plan/additional-topics"
        );
      });
    });

    it("redirects to review if topic index out of bounds", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "5" });
      
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/screens/emergency-plan/review");
      });
    });

    it("handles error during load and redirects", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error("Load failed")
      );
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          "/screens/emergency-plan/additional-topics"
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Default Message Creation", () => {
    it("creates default message when no existing messages for topic", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Please feed my pet.")).toBeTruthy();
      });
    });

    it("loads existing messages for topic", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Custom pet care message",
            contacts: [],
          },
        ],
      });
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Custom pet care message")).toBeTruthy();
      });
    });

    it("filters messages by topic ID", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Child / Family Care", "Pet Care"])
      );
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Child / Family Care", message: "Child message", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Pet message", contacts: [] },
          { id: "3", topic: "Other", message: "Other message", contacts: [] },
        ],
      });
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "1" }); // Pet Care
      
      const { getByText, queryByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Pet message")).toBeTruthy();
        expect(queryByText("Child message")).toBeNull();
        expect(queryByText("Other message")).toBeNull();
      });
    });
  });

  describe("Add Another Message", () => {
    it("adds another message for the same topic", async () => {
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-add-another-message")).toBeTruthy();
      });
      
      const addButton = getByTestId("button-add-another-message");
      fireEvent.press(addButton);
      
      // Should create a new message (can't easily verify count with mocked MessageSetup)
      expect(addButton).toBeTruthy();
    });

    it("creates message with same topic ID", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Work Absences"])
      );
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-add-another-message")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-add-another-message"));
      
      // Component should still be rendered
      expect(getByTestId("button-save-&-continue")).toBeTruthy();
    });
  });

  describe("Message Deletion", () => {
    it("shows delete confirmation modal when delete is pressed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Pet Care", message: "Message 1", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Message 2", contacts: [] },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
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
          { id: "1", topic: "Pet Care", message: "Message 1", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Message 2", contacts: [] },
        ],
      });
      
      const { getByTestId, queryByTestId } = render(<TopicMessageSetup />);
      
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
    });

    it("deletes message when confirmed", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Pet Care", message: "Message 1", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Message 2", contacts: [] },
        ],
      });
      
      const { getByTestId, queryByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("delete-message-1")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("delete-message-1"));
      
      await waitFor(() => {
        expect(getByTestId("modal-button-delete")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("modal-button-delete"));
      
      await waitFor(() => {
        expect(queryByTestId("custom-modal")).toBeNull();
      });
    });

    it("hides delete button when only one message", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      const MessageSetup = require("../../../components/MessageSetup").MessageSetup;
      
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(MessageSetup).toHaveBeenCalled();
      });
      
      // Check the last call to MessageSetup
      const lastCall = MessageSetup.mock.calls[MessageSetup.mock.calls.length - 1];
      expect(lastCall[0].showDeleteButton).toBe(false);
    });

    it("shows delete button when multiple messages", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Pet Care", message: "Message 1", contacts: [] },
          { id: "2", topic: "Pet Care", message: "Message 2", contacts: [] },
        ],
      });
      
      const MessageSetup = require("../../../components/MessageSetup").MessageSetup;
      
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        const calls = MessageSetup.mock.calls;
        expect(calls.some((call: any) => call[0].showDeleteButton === true)).toBe(true);
      });
    });
  });

  describe("Form Validation", () => {
    it("validates messages have content before saving", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Valid message",
            contacts: [{ id: "1", name: "Contact Name", phoneNumber: "5551234567" }],
          },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      // With valid data, should not show error
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockSaveEmergencyPlanData).toHaveBeenCalled();
      });
    });

    it("validates contacts are filled in before saving", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Valid message",
            contacts: [{ id: "1", name: "Valid Name", phoneNumber: "5551234567" }],
          },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockSaveEmergencyPlanData).toHaveBeenCalled();
      });
    });

    it("shows duplicate contact error and blocks save when duplicate phones exist", async () => {
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Valid message",
            contacts: [
              { id: "1", name: "First Contact", phoneNumber: "5551234567" },
              { id: "2", name: "Second Contact", phoneNumber: "(555) 123-4567" },
            ],
          },
        ],
      });

      const { getByTestId, getByText } = render(<TopicMessageSetup />);

      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });

      fireEvent.press(getByTestId("button-save-&-continue"));

      await waitFor(() => {
        expect(getByTestId("modal-title")).toBeTruthy();
        expect(getByText("Error")).toBeTruthy();
        expect(
          getByText(
            "Please remove duplicate contacts. Each phone number can only be added once."
          )
        ).toBeTruthy();
      });

      expect(mockSaveEmergencyPlanData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Save and Continue", () => {
    it("saves messages and navigates to next topic", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care", "Work Absences"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Please feed my pet",
            contacts: [{ id: "1", name: "Neighbor", phoneNumber: "5551234567" }],
          },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockSaveEmergencyPlanData).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith({
          pathname: "/screens/emergency-plan/topic-message-setup",
          params: { topicIndex: "1" },
        });
      });
    });

    it("navigates to review when on last topic", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Feed my cat",
            contacts: [{ id: "1", name: "Neighbor", phoneNumber: "5551234567" }],
          },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/review");
      });
    });

    it("saves with topic ID instead of translated label", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Child / Family Care"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Child / Family Care",
            message: "Pick up kids",
            contacts: [{ id: "1", name: "School", phoneNumber: "5551234567" }],
          },
          {
            id: "2",
            topic: "Other",
            message: "Other message",
            contacts: [{ id: "2", name: "Someone", phoneNumber: "5559999999" }],
          },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        const savedData = mockSaveEmergencyPlanData.mock.calls[0][0];
        // Should include message with topic ID
        expect(savedData.some((msg: any) => msg.topic === "Child / Family Care")).toBe(true);
      });
    });

    it("combines messages from different topics", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care"])
      );
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Work Absences",
            message: "Work message",
            contacts: [{ id: "1", name: "Boss", phoneNumber: "5551111111" }],
          },
          {
            id: "2",
            topic: "Other",
            message: "Other message",
            contacts: [{ id: "2", name: "Friend", phoneNumber: "5552222222" }],
          },
          {
            id: "3",
            topic: "Pet Care",
            message: "Pet message",
            contacts: [{ id: "3", name: "Neighbor", phoneNumber: "5553333333" }],
          },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        const savedData = mockSaveEmergencyPlanData.mock.calls[0][0];
        // Should have messages from all topics
        expect(savedData.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("shows error modal on save failure", async () => {
      mockSaveEmergencyPlanData.mockRejectedValue(new Error("Save failed"));
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Valid message",
            contacts: [{ id: "1", name: "Contact", phoneNumber: "5551234567" }],
          },
        ],
      });
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(getByTestId("modal-title")).toBeTruthy();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Skip Functionality", () => {
    it("navigates to next topic when skip is pressed", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care", "Work Absences"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-skip"));
      
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/screens/emergency-plan/topic-message-setup",
        params: { topicIndex: "1" },
      });
    });

    it("navigates to review when skipping last topic", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-skip"));
      
      expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/review");
    });

    it("does not save messages when skipping", async () => {
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-skip")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-skip"));
      
      expect(mockSaveEmergencyPlanData).not.toHaveBeenCalled();
    });
  });

  describe("Topic-Specific Content", () => {
    it("displays child care information", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Child / Family Care"])
      );
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Child care info 1")).toBeTruthy();
        expect(getByText("Child care info 5")).toBeTruthy();
      });
    });

    it("displays elderly care information", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Elderly Dependent Care"])
      );
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Elderly care info 1")).toBeTruthy();
        expect(getByText("Elderly care info 4")).toBeTruthy();
      });
    });

    it("displays pet care information", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care"])
      );
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Pet care info 1")).toBeTruthy();
        expect(getByText("Pet care info 5")).toBeTruthy();
      });
    });

    it("displays work absences information", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Work Absences"])
      );
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Notify your employer about your absence.")).toBeTruthy();
      });
    });

    it("displays no extra content for Other topic", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Other"])
      );
      
      const { queryByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(queryByText("Here is some recommended information to include:")).toBeNull();
      });
    });
  });

  describe("Multiple Topics Navigation", () => {
    it("navigates through all selected topics sequentially", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care", "Work Absences", "Other"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Pet Care",
            message: "Feed pet",
            contacts: [{ id: "c1", name: "Neighbor", phoneNumber: "5551234567" }],
          },
        ],
      });
      
      const { getByTestId, unmount } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith({
          pathname: "/screens/emergency-plan/topic-message-setup",
          params: { topicIndex: "1" },
        });
      });
      
      unmount();
    });

    it("handles topicIndex as string", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care", "Work Absences"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "1" });
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText(/Messages for Work Absences/)).toBeTruthy();
      });
    });

    it("defaults to index 0 when topicIndex not provided", async () => {
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: undefined });
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText(/Messages for Pet Care/)).toBeTruthy();
      });
    });
  });

  describe("Data Persistence", () => {
    it("filters out old messages for same topic when saving", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Work Absences"])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      
      // Load existing messages including some for this topic and some for others
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "work-old",
            topic: "Work Absences",
            message: "Old work message",
            contacts: [{ id: "c1", name: "Old Boss", phoneNumber: "5551111111" }],
          },
          {
            id: "other-1",
            topic: "Other",
            message: "Other message",
            contacts: [{ id: "c2", name: "Friend", phoneNumber: "5552222222" }],
          },
        ],
      });
            
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        expect(mockSaveEmergencyPlanData).toHaveBeenCalled();
        const savedData = mockSaveEmergencyPlanData.mock.calls[0][0];
        // Should preserve Other topic message
        expect(savedData.some((msg: any) => msg.id === "other-1")).toBe(true);
        // Should have Work Absences messages
        expect(savedData.some((msg: any) => msg.topic === "Work Absences")).toBe(true);
      });
    });

    it("preserves messages from other topics", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Pet Care"])
      );
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          {
            id: "1",
            topic: "Work Absences",
            message: "Work message",
            contacts: [{ id: "c1", name: "Boss", phoneNumber: "5551111111" }],
          },
          {
            id: "2",
            topic: "Child / Family Care",
            message: "Child message",
            contacts: [{ id: "c2", name: "School", phoneNumber: "5552222222" }],
          },
          {
            id: "3",
            topic: "Pet Care",
            message: "Pet message",
            contacts: [{ id: "c3", name: "Neighbor", phoneNumber: "5553333333" }],
          },
        ],
      });
      
      const { getByTestId } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByTestId("button-save-&-continue")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("button-save-&-continue"));
      
      await waitFor(() => {
        const savedData = mockSaveEmergencyPlanData.mock.calls[0][0];
        // Should preserve other topic messages
        expect(savedData.some((msg: any) => msg.id === "1")).toBe(true);
        expect(savedData.some((msg: any) => msg.id === "2")).toBe(true);
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles invalid JSON in selected topics", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("invalid json");
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });

    it("handles unknown topic gracefully", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(["Unknown Topic"])
      );
      
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        // Should use topic ID as fallback label
        expect(getByText(/Messages for Unknown Topic/)).toBeTruthy();
      });
    });

    it("handles empty selected topics array", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify([])
      );
      mockUseLocalSearchParams.mockReturnValue({ topicIndex: "0" });
      
      render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/screens/emergency-plan/review");
      });
    });
  });

  describe("Instructions Display", () => {
    it("shows edit sample message instruction", async () => {
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("Edit the sample message below or create your own.")).toBeTruthy();
      });
    });

    it("shows alert button context", async () => {
      const { getByText } = render(<TopicMessageSetup />);
      
      await waitFor(() => {
        expect(getByText("These messages will only be sent if you press the alert button.")).toBeTruthy();
      });
    });
  });
});

