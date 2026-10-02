import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { MessageSetup, MessageData } from "../MessageSetup";

const mockShowAlert = jest.fn();
const mockPickContact = jest.fn();

jest.mock("../../utils/app-settings", () => ({
  useAppSettings: () => ({
    settings: {
      language: "en",
    },
  }),
}));

jest.mock("../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        editSampleMessage: "Edit sample message",
        contacts: "Contacts",
        contactsHelp: "Contacts help",
        name: "Name",
        phonePrefix: "+1",
        phoneNumber: "Phone number",
        addFromContacts: "Add from Contacts",
        addContact: "Add Contact",
        deleteMessage: "Delete Message",
        done: "Done",
        duplicateContactTitle: "Duplicate Contact",
        duplicateContactMessage:
          "This phone number is already added for this message.",
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock("../../context/ModalContext", () => ({
  useModal: () => ({
    showAlert: mockShowAlert,
  }),
}));

jest.mock("../../utils/contact-picker", () => ({
  pickContact: () => mockPickContact(),
}));

jest.mock("../../utils/storage-utils", () => ({
  loadEmergencyPlanData: jest.fn(async () => ({ messages: [] })),
  saveEmergencyPlanData: jest.fn(async () => undefined),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@expo/vector-icons/Feather", () => "Feather");

jest.mock("../EnhancedTextInput", () => {
  const React = require("react");
  const { TextInput } = require("react-native");

  return {
    EnhancedTextInput: (props: any) => <TextInput {...props} />,
  };
});

describe("MessageSetup - addFromDeviceContacts", () => {
  const baseMessageData: MessageData = {
    id: "msg-1",
    topic: "Legal Support",
    message: "Test message",
    contacts: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fills an existing blank contact row when contact is picked", async () => {
    mockPickContact.mockResolvedValue({
      name: "Hank M. Zakroff",
      phoneNumber: "5557664823",
    });

    const onUpdate = jest.fn();
    const messageData: MessageData = {
      ...baseMessageData,
      contacts: [{ id: "blank-1", name: "", phoneNumber: "" }],
    };

    const { getByText } = render(
      <MessageSetup messageData={messageData} onUpdate={onUpdate} />
    );

    fireEvent.press(getByText("Add from Contacts"));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as MessageData;
    expect(lastCall.contacts).toHaveLength(1);
    expect(lastCall.contacts[0]).toEqual({
      id: "blank-1",
      name: "Hank M. Zakroff",
      phoneNumber: "5557664823",
    });
  });

  it("appends a new contact when there is no blank row", async () => {
    mockPickContact.mockResolvedValue({
      name: "Kate Bell",
      phoneNumber: "5555648583",
    });

    const onUpdate = jest.fn();
    const messageData: MessageData = {
      ...baseMessageData,
      contacts: [{ id: "contact-1", name: "Existing", phoneNumber: "5551112222" }],
    };

    const { getByText } = render(
      <MessageSetup messageData={messageData} onUpdate={onUpdate} />
    );

    fireEvent.press(getByText("Add from Contacts"));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as MessageData;
    expect(lastCall.contacts).toHaveLength(2);
    expect(lastCall.contacts[0]).toEqual({
      id: "contact-1",
      name: "Existing",
      phoneNumber: "5551112222",
    });
    expect(lastCall.contacts[1].name).toBe("Kate Bell");
    expect(lastCall.contacts[1].phoneNumber).toBe("5555648583");
  });

  it("shows duplicate alert and does not update state for duplicate phone", async () => {
    mockPickContact.mockResolvedValue({
      name: "Duplicate Person",
      phoneNumber: "(555) 111-2222",
    });

    const onUpdate = jest.fn();
    const messageData: MessageData = {
      ...baseMessageData,
      contacts: [{ id: "contact-1", name: "Existing", phoneNumber: "5551112222" }],
    };

    const { getByText } = render(
      <MessageSetup messageData={messageData} onUpdate={onUpdate} />
    );

    fireEvent.press(getByText("Add from Contacts"));

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        "Duplicate Contact",
        "This phone number is already added for this message."
      );
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
