import React, { useState, useEffect } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  Keyboard,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import Feather from "@expo/vector-icons/Feather";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";
import { useModal } from "../context/ModalContext";
import { EnhancedTextInput } from "./EnhancedTextInput";
import { saveEmergencyPlanData, loadEmergencyPlanData } from "../utils/storage-utils";
import { pickContact } from "../utils/contact-picker";

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

export interface MessageData {
  id: string;
  topic: string;
  message: string;
  contacts: Contact[];
}

interface MessageSetupProps {
  messageData: MessageData;
  onUpdate: (updatedMessage: MessageData) => void;
  onDelete?: () => void;
  showDeleteButton?: boolean;
  readOnly?: boolean;
}

export const MessageSetup: React.FC<MessageSetupProps> = ({
  messageData,
  onUpdate,
  onDelete,
  showDeleteButton = true,
  readOnly = false,
}) => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("message-setup", settings.language);
  const modal = useModal();

  // Initialize with the message from messageData
  const [message, setMessage] = useState(messageData.message || "");
  const [contacts, setContacts] = useState<Contact[]>(messageData.contacts);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const normalizePhoneNumber = (phoneNumber: string): string => {
    return phoneNumber.replace(/\D/g, "");
  };

  const isDuplicatePhoneNumber = (
    phoneNumber: string,
    excludingContactId?: string
  ): boolean => {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      return false;
    }

    return contacts.some((contact) => {
      if (excludingContactId && contact.id === excludingContactId) {
        return false;
      }

      return normalizePhoneNumber(contact.phoneNumber) === normalized;
    });
  };

  // Debug: Log the topic name when component mounts or message data changes

  // Update message when messageData changes
  useEffect(() => {
    setMessage(messageData.message || "");
  }, [messageData.message]);

  // Add keyboard listeners for Android
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Auto-save current message state to storage on blur
  const autoSaveMessage = async () => {
    try {
      // Load all messages
      const { messages } = await loadEmergencyPlanData();
      
      // Update the current message in the array
      const updatedMessages = messages.map(msg =>
        msg.id === messageData.id
          ? { ...messageData, message, contacts }
          : msg
      );
      
      // If message doesn't exist yet, add it
      if (!messages.find(msg => msg.id === messageData.id)) {
        updatedMessages.push({ ...messageData, message, contacts });
      }
      
      // Save back to storage
      await saveEmergencyPlanData(updatedMessages);
    } catch (error) {
      console.error("Error auto-saving message:", error);
      // Don't throw - auto-save is best-effort
    }
  };

  const handleMessageChange = (text: string) => {
    setMessage(text);
    // Make sure to preserve the exact topic name during updates
    onUpdate({
      ...messageData,
      message: text,
      contacts,
    });
  };

  const handleContactChange = (
    id: string,
    field: "name" | "phoneNumber",
    value: string
  ) => {
    // Handle phone number formatting and validation
    if (field === "phoneNumber") {
      // Remove any non-digit characters
      const digitsOnly = value.replace(/\D/g, "");

      // Limit to 10 digits
      const truncated = digitsOnly.slice(0, 10);

      if (isDuplicatePhoneNumber(truncated, id)) {
        modal.showAlert(
          t("duplicateContactTitle"),
          t("duplicateContactMessage")
        );
        return;
      }

      // Update with formatted value
      const updatedContacts = contacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: truncated } : contact
      );

      setContacts(updatedContacts);

      // Make sure to preserve the exact topic name from messageData
      onUpdate({
        ...messageData,
        message,
        contacts: updatedContacts,
      });
    } else {
      // Handle name field normally
      const updatedContacts = contacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact
      );

      setContacts(updatedContacts);

      // Make sure to preserve the exact topic name from messageData
      onUpdate({
        ...messageData,
        message,
        contacts: updatedContacts,
      });
    }
  };

  const addContact = () => {
    const newContact: Contact = {
      id: Date.now().toString(),
      name: "",
      phoneNumber: "",
    };
    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);

    onUpdate({
      ...messageData, // This preserves the exact topic property
      message,
      contacts: updatedContacts,
    });
  };

  const addFromDeviceContacts = async () => {
    try {
      const picked = await pickContact();
      if (!picked) {
        return; // User cancelled or permission denied
      }

      const newContact: Contact = {
        id: Date.now().toString(),
        name: picked.name,
        phoneNumber: picked.phoneNumber,
      };

      if (isDuplicatePhoneNumber(newContact.phoneNumber)) {
        modal.showAlert(t("duplicateContactTitle"), t("duplicateContactMessage"));
        return;
      }

      // If there's an existing blank contact row, fill it instead of adding a new one
      const blankIndex = contacts.findIndex(
        (contact) =>
          contact.name.trim().length === 0 &&
          contact.phoneNumber.trim().length === 0
      );

      const updatedContacts =
        blankIndex >= 0
          ? contacts.map((contact, index) =>
              index === blankIndex
                ? {
                    ...contact,
                    name: newContact.name,
                    phoneNumber: newContact.phoneNumber,
                  }
                : contact
            )
          : [...contacts, newContact];
      setContacts(updatedContacts);

      onUpdate({
        ...messageData,
        message,
        contacts: updatedContacts,
      });
    } catch (error) {
      console.error("Error adding contact from device:", error);
    }
  };

  const removeContact = (id: string) => {
    let updatedContacts: Contact[];

    if (contacts.length <= 1) {
      updatedContacts = contacts.map((contact) =>
        contact.id === id ? { ...contact, name: "", phoneNumber: "" } : contact
      );
    } else {
      updatedContacts = contacts.filter((contact) => contact.id !== id);
    }

    setContacts(updatedContacts);

    onUpdate({
      ...messageData,
      message,
      contacts: updatedContacts,
    });
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Android floating Done button
  const AndroidDoneButton = () => {
    if (Platform.OS === "android" && isKeyboardVisible) {
      return (
        <TouchableOpacity
          onPress={dismissKeyboard}
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            backgroundColor: "#3b82f6",
            borderRadius: 9999,
            padding: 12,
            zIndex: 50,
            elevation: 5,
          }}
        >
          <Text style={{ color: "white", fontWeight: "500" }}>{t("done")}</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <View className="relative">
      <View className="mb-5 rounded-3xl border border-[#E0E0E0] bg-[#e3e9fe] p-4">
        <Text className="mb-4 text-center text-lg font-bold text-black">
          {/* {messageData.topic} {t("message")} */}
          {t("editSampleMessage")}
        </Text>

        <EnhancedTextInput
          className="mb-4 min-h-[100px] rounded-lg border border-[#CCCCCC] bg-white p-3 text-black"
          multiline
          value={message}
          onChangeText={handleMessageChange}
          onBlur={autoSaveMessage}
          placeholderTextColor="#888"
          editable={!readOnly}
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={dismissKeyboard}
          textAlign="left"
          keyboardType="default"
          style={{ textAlignVertical: "top" }}
          doneButtonText={t("done")}
        />
        <View className="pb-8">
          <Text className="mb-3 mt-2 text-center text-base font-bold text-black">
            {t("contacts")}
          </Text>
          <Text className="text-center">{t("contactsHelp")}</Text>
        </View>

        {contacts.map((contact) => (
          <View
            key={contact.id}
            className="mb-3 rounded-lg border border-[#E0E0E0] bg-[#eef2fe] p-3"
          >
            <View className="flex-row items-center">
              <EnhancedTextInput
                className="mb-3 mr-2 flex-1 rounded-lg border border-[#CCCCCC] bg-white p-3 text-black"
                value={contact.name}
                onChangeText={(text) =>
                  handleContactChange(contact.id, "name", text)
                }
                onBlur={autoSaveMessage}
                placeholder={t("name")}
                placeholderTextColor="#888"
                editable={!readOnly}
                returnKeyType="done"
                keyboardType="default"
                blurOnSubmit={true}
                onSubmitEditing={dismissKeyboard}
                textAlign="left"
                doneButtonText={t("done")}
              />

              {!readOnly && (
                <TouchableOpacity
                  className="mb-3 justify-center rounded-full bg-[#e4d7eb] self-center p-1"
                  onPress={() => removeContact(contact.id)}
                >
                  <Feather name="trash" size={20} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>

            <View className="relative mb-3 rounded-lg border border-[#CCCCCC] bg-white">
              <Text className="absolute left-3 top-3 text-black">
                {t("phonePrefix")}
              </Text>
              <EnhancedTextInput
                className="ml-8 p-3 text-black"
                value={contact.phoneNumber}
                onChangeText={(text) =>
                  handleContactChange(contact.id, "phoneNumber", text)
                }
                onBlur={autoSaveMessage}
                placeholder={t("phoneNumber")}
                placeholderTextColor="#888"
                keyboardType="phone-pad"
                editable={!readOnly}
                maxLength={10}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={dismissKeyboard}
                textAlign="left"
                doneButtonText={t("done")}
              />
            </View>
          </View>
        ))}


        {!readOnly && (
          <View>
            <TouchableOpacity
              className="mb-3 mt-2 flex-row items-center justify-center rounded-3xl bg-[#5a69cc] p-3"
              onPress={addFromDeviceContacts}
            >
              <Feather name="user-plus" size={20} color="#ffffff" />
              <Text className="ml-2 font-medium text-[#ffffff]">
                {t("addFromContacts")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mb-4 flex-row items-center justify-center rounded-3xl bg-[#60646c] p-3"
              onPress={addContact}
            >
              <Feather name="plus" size={20} color="#ffffff" />
              <Text className="ml-2 font-medium text-[#ffffff]">
                {t("addContact")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showDeleteButton && onDelete && !readOnly && (
          <TouchableOpacity
            className="flex-row items-center justify-center rounded-3xl bg-[#e4d7eb] p-3"
            onPress={onDelete}
          >
            <Feather name="trash" size={20} color="#FF3B30" />
            <Text className="ml-2 font-medium text-[#FF3B30]">
              {t("deleteMessage")}
            </Text>
          </TouchableOpacity>
        )}

        {readOnly && contacts.length > 0 && (
          <View className="mt-2">
            <Text className="mb-2 font-bold text-gray-700">
              {t("recipients")}:
            </Text>
            <View className="flex-row flex-wrap">
              {contacts.map((contact) => (
                <View
                  key={contact.id}
                  className="m-1 rounded-full bg-blue-100 px-3 py-1"
                >
                  <Text className="text-blue-800">{contact.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Android floating done button */}
      <AndroidDoneButton />
    </View>
  );
};

export default MessageSetup;
