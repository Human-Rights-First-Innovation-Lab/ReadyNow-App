import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import PersonalMessageSetup from "../personal-message-setup";

const mockPush = jest.fn();
const mockShowError = jest.fn();
const mockShowConfirm = jest.fn();
const mockLoadEmergencyPlanData = jest.fn();
const mockSaveEmergencyPlanData = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  Stack: {
    Screen: ({ children }: any) => children,
  },
}));

jest.mock("../../../utils/app-settings", () => ({
  useAppSettings: () => ({
    settings: {
      language: "en",
    },
  }),
}));

jest.mock("../../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        title: "Personal Message Setup",
        personalSafetyMessages: "Personal Safety Messages",
        createPersonalSafetyMessages: "Create personal safety messages",
        createPersonalSafetyMessagesBold: "personal safety messages",
        recommendIncluding: "We recommend including:",
        lawyerInfo: "Lawyer info",
        aNumberInfo: "A-number info",
        healthInfo: "Health info",
        documentsInfo: "Documents info",
        editSample: "Edit the sample message",
        onlySentIf: "Only sent if alert is pressed",
        addAnotherMessage: "Add Another Message",
        skip: "Skip",
        saveAndContinue: "Save & Continue",
        errorLoading: "Error loading",
        errorEmptyMessage: "Please enter a message",
        errorEmptyContact: "Please fill in all contact information",
        errorDuplicateContact:
          "Please remove duplicate contacts. Each phone number can only be added once.",
        errorSaving: "Error saving",
        deleteMessage: "Delete Message",
        deleteConfirmation: "Delete confirmation",
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock("../../../context/ModalContext", () => ({
  useModal: () => ({
    showError: mockShowError,
    showConfirm: mockShowConfirm,
  }),
}));

jest.mock("../../../utils/storage-utils", () => ({
  loadEmergencyPlanData: () => mockLoadEmergencyPlanData(),
  saveEmergencyPlanData: (data: unknown) => mockSaveEmergencyPlanData(data),
}));

jest.mock("../../../utils/default-messages", () => ({
  getDefaultMessageByTopic: jest.fn(() => "Default personal emergency message"),
}));

jest.mock("../../../components/MessageSetup", () => ({
  MessageSetup: jest.fn((props) => {
    const React = require("react");
    const { View, Text } = require("react-native");
    return React.createElement(
      View,
      { testID: `message-${props.messageData.id}` },
      React.createElement(Text, null, props.messageData.message)
    );
  }),
}));

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

jest.mock("../../../components/EmergencyPlanBottomNavigation", () => {
  return jest.fn(() => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "bottom-navigation" });
  });
});

describe("PersonalMessageSetup duplicate validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveEmergencyPlanData.mockResolvedValue(undefined);
  });

  it("shows errorDuplicateContact and blocks save/navigation when duplicates exist", async () => {
    mockLoadEmergencyPlanData.mockResolvedValue({
      messages: [
        {
          id: "personal-1",
          topic: "Personal Emergency",
          message: "Personal emergency content",
          contacts: [
            { id: "c1", name: "Alice", phoneNumber: "5551112222" },
            { id: "c2", name: "Bob", phoneNumber: "(555) 111-2222" },
          ],
        },
      ],
    });

    const { getByTestId } = render(<PersonalMessageSetup />);

    await waitFor(() => {
      expect(getByTestId("button-save-&-continue")).toBeTruthy();
    });

    fireEvent.press(getByTestId("button-save-&-continue"));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        "Please remove duplicate contacts. Each phone number can only be added once."
      );
    });

    expect(mockSaveEmergencyPlanData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
