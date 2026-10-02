import {
  saveEmergencyPlanData,
  loadEmergencyPlanData,
  resetEmergencyPlanData,
} from "../storage-utils";
import * as SecureStore from "expo-secure-store";
import { encryptData, decryptData, wipeSensitiveData } from "../encryption-utils";
import type { MessageData } from "../../components/MessageSetup";

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock encryption utilities
jest.mock("../encryption-utils", () => ({
  encryptData: jest.fn((data: string) => Promise.resolve(`encrypted_${data}`)),
  decryptData: jest.fn((data: string) => Promise.resolve(data.replace("encrypted_", ""))),
  wipeSensitiveData: jest.fn(),
  authenticateWithDeviceLock: jest.fn(),
}));

// Mock emergency plan utils
jest.mock("../emergency-plan-utils", () => ({
  transformToNewFormat: jest.fn((data, phoneNumber) => ({
    [phoneNumber]: {
      messages: data.messages,
      legalSupport: {},
    },
  })),
  transformToOldFormat: jest.fn((data, phoneNumber) => ({
    messages: data[phoneNumber]?.messages || [],
  })),
}));

describe("Storage Utils - Message Management", () => {
  const mockPhoneNumber = "5551234567";
  
  const mockMessage: MessageData = {
    id: "msg-1",
    topic: "Personal Emergency",
    message: "Test emergency message",
    contacts: [
      {
        id: "contact-1",
        name: "John Doe",
        phoneNumber: "+15551234567",
      },
    ],
  };

  const mockMessages: MessageData[] = [
    mockMessage,
    {
      id: "msg-2",
      topic: "Legal Support",
      message: "Legal help message",
      contacts: [
        {
          id: "contact-2",
          name: "Jane Smith",
          phoneNumber: "+15559876543",
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for phone number
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === "user_phone_number") {
        return Promise.resolve(mockPhoneNumber);
      }
      return Promise.resolve(null);
    });
  });

  describe("saveEmergencyPlanData", () => {
    it("saves messages successfully with array format", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveEmergencyPlanData(mockMessages);

      // Should set format version
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "emergency_data_format_version",
        "5"
      );

      // Should encrypt data
      expect(encryptData).toHaveBeenCalled();

      // Should save encrypted data
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "emergency_plan_data",
        expect.stringContaining("encrypted_")
      );
    });

    it("saves messages successfully with object format", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveEmergencyPlanData({ messages: mockMessages });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "emergency_data_format_version",
        "5"
      );
      expect(encryptData).toHaveBeenCalled();
    });

    it("uses provided phone number", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      const customPhone = "5559999999";

      await saveEmergencyPlanData(mockMessages, customPhone);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(encryptData).toHaveBeenCalled();
    });

    it("never invents a phone number when none is provided", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveEmergencyPlanData(mockMessages);

      // The plan is partitioned under a sentinel, but nothing is ever written
      // to user_phone_number. AlertButton forwards that key to the NILRA
      // intake API, so a fabricated value there would be sent onward as the
      // user's real contact number.
      const phoneWrites = (
        SecureStore.setItemAsync as jest.Mock
      ).mock.calls.filter((call) => call[0] === "user_phone_number");
      expect(phoneWrites).toHaveLength(0);
    });

    it("handles empty messages array", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveEmergencyPlanData([]);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "emergency_data_format_version",
        "5"
      );
      expect(encryptData).toHaveBeenCalled();
    });

    it("never writes plan data unencrypted when encryption fails", async () => {
      // Emergency plans hold A-numbers, dates of birth and contact details.
      // A failed encryption must abort the save rather than silently downgrade
      // the record to plaintext, which is what the old implementation did.
      (encryptData as jest.Mock).mockRejectedValueOnce(new Error("Encryption failed"));
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await expect(saveEmergencyPlanData(mockMessages)).rejects.toThrow(
        "Encryption failed"
      );

      // No plan record and no format version may be written
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        "emergency_plan_data",
        expect.any(String)
      );
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        "emergency_data_format_version",
        expect.any(String)
      );
    });

    it("never marks data as the retired unencrypted format", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveEmergencyPlanData(mockMessages);

      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        "emergency_data_format_version",
        "3"
      );
    });

    it("throws error when storage fails", async () => {
      const storageError = new Error("Storage error");
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(storageError);

      await expect(saveEmergencyPlanData(mockMessages)).rejects.toThrow("Storage error");
    });

    it("handles large data by chunking", async () => {
      // Create a large message that will exceed chunk size
      const largeMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        topic: "Test Topic",
        message: "A".repeat(100), // Large message content
        contacts: [
          {
            id: `contact-${i}`,
            name: `Contact ${i}`,
            phoneNumber: `+1555${i.toString().padStart(7, "0")}`,
          },
        ],
      }));

      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveEmergencyPlanData(largeMessages);

      // Should save chunk count
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "emergency_data_chunk_count",
        expect.any(String)
      );

      // Should save chunks
      const chunkCalls = (SecureStore.setItemAsync as jest.Mock).mock.calls.filter(
        (call) => call[0].startsWith("emergency_data_chunk_")
      );
      expect(chunkCalls.length).toBeGreaterThan(0);
    });
  });

  describe("loadEmergencyPlanData", () => {
    it("loads messages successfully from encrypted format (version 4)", async () => {
      const encryptedData = 'encrypted_{"5551234567":{"messages":[]}}';
      
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_format_version") return Promise.resolve("4");
        if (key === "emergency_plan_data") return Promise.resolve(encryptedData);
        if (key === "user_phone_number") return Promise.resolve(mockPhoneNumber);
        return Promise.resolve(null);
      });

      const result = await loadEmergencyPlanData();

      expect(decryptData).toHaveBeenCalledWith(encryptedData);
      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it("loads messages from chunked data", async () => {
      const chunk1 = "encrypted_part1";
      const chunk2 = "part2";
      
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_format_version") return Promise.resolve("4");
        if (key === "emergency_data_chunk_count") return Promise.resolve("2");
        if (key === "emergency_data_chunk_0") return Promise.resolve(chunk1);
        if (key === "emergency_data_chunk_1") return Promise.resolve(chunk2);
        if (key === "user_phone_number") return Promise.resolve(mockPhoneNumber);
        return Promise.resolve(null);
      });

      const result = await loadEmergencyPlanData();

      // Should decrypt reassembled chunks
      expect(decryptData).toHaveBeenCalledWith(chunk1 + chunk2);
      expect(result).toHaveProperty("messages");
    });

    it("returns empty messages when no data exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await loadEmergencyPlanData();

      expect(result).toEqual({ messages: [] });
    });

    it("handles decryption errors gracefully", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_format_version") return Promise.resolve("4");
        if (key === "emergency_plan_data") return Promise.resolve("encrypted_data");
        return Promise.resolve(null);
      });

      (decryptData as jest.Mock).mockRejectedValueOnce(new Error("Decryption failed"));

      const result = await loadEmergencyPlanData();

      expect(result).toEqual({ messages: [] });
    });

    it("handles missing chunks gracefully", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_format_version") return Promise.resolve("4");
        if (key === "emergency_data_chunk_count") return Promise.resolve("3");
        if (key === "emergency_data_chunk_0") return Promise.resolve("chunk1");
        // Missing chunk 1
        if (key === "emergency_data_chunk_2") return Promise.resolve("chunk3");
        if (key === "user_phone_number") return Promise.resolve(mockPhoneNumber);
        return Promise.resolve(null);
      });

      const result = await loadEmergencyPlanData();

      // Should still attempt to decrypt available chunks
      expect(result).toHaveProperty("messages");
    });

    it("loads unencrypted data (format version 3)", async () => {
      const unencryptedData = JSON.stringify({
        [mockPhoneNumber]: {
          messages: mockMessages,
        },
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_format_version") return Promise.resolve("3");
        if (key === "emergency_plan_data") return Promise.resolve(unencryptedData);
        if (key === "user_phone_number") return Promise.resolve(mockPhoneNumber);
        return Promise.resolve(null);
      });

      const result = await loadEmergencyPlanData();

      // Should not call decrypt for version 3
      expect(decryptData).not.toHaveBeenCalled();
      expect(result).toHaveProperty("messages");
    });

    it("normalizes topic names on load", async () => {
      const messagesWithTranslatedTopics = [
        {
          id: "msg-1",
          topic: "법적지원", // Korean for Legal Support
          message: "Test",
          contacts: [],
        },
        {
          id: "msg-2",
          topic: "Apoyo Legal", // Spanish for Legal Support
          message: "Test",
          contacts: [],
        },
      ];

      const dataWithTranslations = JSON.stringify({
        [mockPhoneNumber]: {
          messages: messagesWithTranslatedTopics,
        },
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_format_version") return Promise.resolve("3");
        if (key === "emergency_plan_data") return Promise.resolve(dataWithTranslations);
        if (key === "user_phone_number") return Promise.resolve(mockPhoneNumber);
        return Promise.resolve(null);
      });

      const result = await loadEmergencyPlanData();

      expect(result).toHaveProperty("messages");
    });
  });

  describe("Message Deletion", () => {
    it("deletes a message by filtering it out", async () => {
      // First, save messages
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      await saveEmergencyPlanData(mockMessages);

      // Then delete one message
      const updatedMessages = mockMessages.filter((msg) => msg.id !== "msg-1");
      await saveEmergencyPlanData(updatedMessages);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(encryptData).toHaveBeenCalled();
    });

    it("handles deletion of non-existent message", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      // Try to delete a message that doesn't exist
      const updatedMessages = mockMessages.filter((msg) => msg.id !== "non-existent");
      await saveEmergencyPlanData(updatedMessages);

      // Should still save successfully
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it("handles deletion of all messages", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await saveEmergencyPlanData([]);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(encryptData).toHaveBeenCalled();
    });
  });

  describe("resetEmergencyPlanData", () => {
    it("calls wipeSensitiveData to clear all data", async () => {
      (wipeSensitiveData as jest.Mock).mockResolvedValue(undefined);

      await resetEmergencyPlanData();

      expect(wipeSensitiveData).toHaveBeenCalled();
    });

    it("throws error when wipe fails", async () => {
      const wipeError = new Error("Wipe failed");
      (wipeSensitiveData as jest.Mock).mockRejectedValue(wipeError);

      await expect(resetEmergencyPlanData()).rejects.toThrow("Wipe failed");
    });
  });

  describe("Message Updates", () => {
    it("updates a message by saving modified array", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      // Update a message
      const updatedMessages = mockMessages.map((msg) =>
        msg.id === "msg-1"
          ? { ...msg, message: "Updated message content" }
          : msg
      );

      await saveEmergencyPlanData(updatedMessages);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(encryptData).toHaveBeenCalled();
    });

    it("adds a new message to existing messages", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      const newMessage: MessageData = {
        id: "msg-3",
        topic: "New Topic",
        message: "New message",
        contacts: [],
      };

      const updatedMessages = [...mockMessages, newMessage];
      await saveEmergencyPlanData(updatedMessages);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles messages with special characters", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      const specialMessage: MessageData = {
        id: "msg-special",
        topic: "Test",
        message: "Message with émojis 🚨 and spëcial çhars",
        contacts: [
          {
            id: "contact-special",
            name: "José García",
            phoneNumber: "+15551234567",
          },
        ],
      };

      await saveEmergencyPlanData([specialMessage]);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(encryptData).toHaveBeenCalled();
    });

    it("handles messages with empty contacts", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      const messageWithNoContacts: MessageData = {
        id: "msg-no-contacts",
        topic: "Test",
        message: "Message without contacts",
        contacts: [],
      };

      await saveEmergencyPlanData([messageWithNoContacts]);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it("handles messages with multiple contacts", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      const messageWithManyContacts: MessageData = {
        id: "msg-many-contacts",
        topic: "Test",
        message: "Message with many contacts",
        contacts: Array.from({ length: 10 }, (_, i) => ({
          id: `contact-${i}`,
          name: `Contact ${i}`,
          phoneNumber: `+1555${i.toString().padStart(7, "0")}`,
        })),
      };

      await saveEmergencyPlanData([messageWithManyContacts]);

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });
  });
});


