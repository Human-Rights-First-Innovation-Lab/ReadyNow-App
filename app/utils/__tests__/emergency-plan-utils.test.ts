import {
  transformToNewFormat,
  transformToOldFormat,
  type EmergencyPlanData,
} from "../emergency-plan-utils";
import type { MessageData } from "../../components/MessageSetup";

describe("Emergency Plan Utils", () => {
  const mockPhoneNumber = "5551234567";

  const mockLegalMessage: MessageData = {
    id: "legal-1",
    topic: "Legal Support",
    message: "I need legal assistance",
    contacts: [
      {
        id: "contact-legal-1",
        name: "Attorney Smith",
        phoneNumber: "+15551111111",
      },
    ],
  };

  const mockPersonalMessage: MessageData = {
    id: "personal-1",
    topic: "Personal Emergency",
    message: "Emergency contact needed",
    contacts: [
      {
        id: "contact-personal-1",
        name: "John Doe",
        phoneNumber: "+15552222222",
      },
    ],
  };

  const mockTopicMessage: MessageData = {
    id: "topic-1",
    topic: "Child / Family Care",
    message: "Need childcare help",
    contacts: [
      {
        id: "contact-topic-1",
        name: "Jane Smith",
        phoneNumber: "+15553333333",
      },
    ],
  };

  describe("transformToNewFormat", () => {
    it("transforms empty messages array", () => {
      const oldData = { messages: [] };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result).toEqual({
        [mockPhoneNumber]: {
          language: "en",
        },
      });
    });

    it("transforms Legal Support messages", () => {
      const oldData = { messages: [mockLegalMessage] };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].lawyerInfo).toBeDefined();
      expect(result[mockPhoneNumber].lawyerInfo?.messages).toHaveLength(1);
      expect(result[mockPhoneNumber].lawyerInfo?.messages[0]).toEqual({
        id: "legal-1",
        message: "I need legal assistance",
        contacts: [
          {
            id: "contact-legal-1",
            contactName: "Attorney Smith",
            contactNumber: "+15551111111",
          },
        ],
      });
    });

    it("transforms Personal Emergency messages", () => {
      const oldData = { messages: [mockPersonalMessage] };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].basicEmergencyInfo).toBeDefined();
      expect(result[mockPhoneNumber].basicEmergencyInfo?.messages).toHaveLength(1);
      expect(result[mockPhoneNumber].basicEmergencyInfo?.messages[0]).toEqual({
        id: "personal-1",
        message: "Emergency contact needed",
        contacts: [
          {
            id: "contact-personal-1",
            contactName: "John Doe",
            contactNumber: "+15552222222",
          },
        ],
      });
    });

    it("transforms topic-based messages", () => {
      const oldData = { messages: [mockTopicMessage] };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].topics).toBeDefined();
      expect(result[mockPhoneNumber].topics?.[0]).toHaveProperty("Child / Family Care");
      expect(result[mockPhoneNumber].topics?.[0]["Child / Family Care"].messages).toHaveLength(1);
    });

    it("transforms multiple message types together", () => {
      const oldData = {
        messages: [mockLegalMessage, mockPersonalMessage, mockTopicMessage],
      };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].lawyerInfo).toBeDefined();
      expect(result[mockPhoneNumber].basicEmergencyInfo).toBeDefined();
      expect(result[mockPhoneNumber].topics).toBeDefined();
    });

    it("handles messages with multiple contacts", () => {
      const messageWithMultipleContacts: MessageData = {
        id: "msg-1",
        topic: "Legal Support",
        message: "Multiple contacts",
        contacts: [
          {
            id: "contact-1",
            name: "Contact 1",
            phoneNumber: "+15551111111",
          },
          {
            id: "contact-2",
            name: "Contact 2",
            phoneNumber: "+15552222222",
          },
          {
            id: "contact-3",
            name: "Contact 3",
            phoneNumber: "+15553333333",
          },
        ],
      };

      const oldData = { messages: [messageWithMultipleContacts] };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].lawyerInfo?.messages[0].contacts).toHaveLength(3);
    });

    it("handles custom language parameter", () => {
      const oldData = { messages: [] };
      const result = transformToNewFormat(oldData, mockPhoneNumber, "es");

      expect(result[mockPhoneNumber].language).toBe("es");
    });

    it("handles all standard topic types", () => {
      const topicMessages: MessageData[] = [
        { id: "1", topic: "Child / Family Care", message: "Test 1", contacts: [] },
        { id: "2", topic: "Elderly Dependent Care", message: "Test 2", contacts: [] },
        { id: "3", topic: "Pet Care", message: "Test 3", contacts: [] },
        { id: "4", topic: "Work Absences", message: "Test 4", contacts: [] },
        { id: "5", topic: "Other", message: "Test 5", contacts: [] },
      ];

      const oldData = { messages: topicMessages };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].topics?.[0]).toHaveProperty("Child / Family Care");
      expect(result[mockPhoneNumber].topics?.[0]).toHaveProperty("Elderly Dependent Care");
      expect(result[mockPhoneNumber].topics?.[0]).toHaveProperty("Pet Care");
      expect(result[mockPhoneNumber].topics?.[0]).toHaveProperty("Work Absences");
      expect(result[mockPhoneNumber].topics?.[0]).toHaveProperty("Other");
    });

    it("handles custom topic names", () => {
      const customTopicMessage: MessageData = {
        id: "custom-1",
        topic: "Custom Topic Name",
        message: "Custom message",
        contacts: [],
      };

      const oldData = { messages: [customTopicMessage] };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].topics?.[0]).toHaveProperty("customtopicname");
    });

    it("handles undefined messages property", () => {
      const oldData = {};
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result).toEqual({
        [mockPhoneNumber]: {
          language: "en",
        },
      });
    });

    it("groups multiple messages of same topic", () => {
      const messages: MessageData[] = [
        { id: "1", topic: "Pet Care", message: "Message 1", contacts: [] },
        { id: "2", topic: "Pet Care", message: "Message 2", contacts: [] },
        { id: "3", topic: "Pet Care", message: "Message 3", contacts: [] },
      ];

      const oldData = { messages };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].topics?.[0]["Pet Care"].messages).toHaveLength(3);
    });
  });

  describe("transformToOldFormat", () => {
    it("transforms empty data", () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result).toEqual({ messages: [] });
    });

    it("transforms Legal Support messages back", () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
          lawyerInfo: {
            messages: [
              {
                id: "legal-1",
                message: "I need legal assistance",
                contacts: [
                  {
                    id: "contact-legal-1",
                    contactName: "Attorney Smith",
                    contactNumber: "+15551111111",
                  },
                ],
              },
            ],
          },
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].topic).toBe("Legal Support");
      expect(result.messages[0].message).toBe("I need legal assistance");
      expect(result.messages[0].contacts[0].name).toBe("Attorney Smith");
    });

    it("transforms Personal Emergency messages back", () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
          basicEmergencyInfo: {
            messages: [
              {
                id: "personal-1",
                message: "Emergency contact needed",
                contacts: [
                  {
                    id: "contact-personal-1",
                    contactName: "John Doe",
                    contactNumber: "+15552222222",
                  },
                ],
              },
            ],
          },
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].topic).toBe("Personal Emergency");
      expect(result.messages[0].message).toBe("Emergency contact needed");
    });

    it("transforms topic messages back", () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
          topics: [
            {
              "Child / Family Care": {
                messages: [
                  {
                    id: "topic-1",
                    message: "Need childcare help",
                    contacts: [
                      {
                        id: "contact-1",
                        contactName: "Jane Smith",
                        contactNumber: "+15553333333",
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].topic).toBe("Child / Family Care");
      expect(result.messages[0].message).toBe("Need childcare help");
    });

    it("generates IDs when missing", () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
          lawyerInfo: {
            messages: [
              {
                message: "Test message",
                contacts: [
                  {
                    contactName: "Test Contact",
                    contactNumber: "+15551234567",
                  },
                ],
              },
            ],
          },
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result.messages[0].id).toBeDefined();
      expect(result.messages[0].id).toContain("legal-");
      expect(result.messages[0].contacts[0].id).toBeDefined();
      expect(result.messages[0].contacts[0].id).toContain("contact-");
    });

    it("handles non-existent phone number", () => {
      const newData: EmergencyPlanData = {
        "9999999999": {
          language: "en",
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result).toEqual({ messages: [] });
    });

    it("handles all message types together", () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
          lawyerInfo: {
            messages: [
              {
                id: "legal-1",
                message: "Legal message",
                contacts: [],
              },
            ],
          },
          basicEmergencyInfo: {
            messages: [
              {
                id: "personal-1",
                message: "Personal message",
                contacts: [],
              },
            ],
          },
          topics: [
            {
              "Pet Care": {
                messages: [
                  {
                    id: "topic-1",
                    message: "Pet care message",
                    contacts: [],
                  },
                ],
              },
            },
          ],
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result.messages).toHaveLength(3);
      expect(result.messages.find((m) => m.topic === "Legal Support")).toBeDefined();
      expect(result.messages.find((m) => m.topic === "Personal Emergency")).toBeDefined();
      expect(result.messages.find((m) => m.topic === "Pet Care")).toBeDefined();
    });

    it('handles lowercase "other" topic for backwards compatibility', () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
          topics: [
            {
              other: {
                messages: [
                  {
                    id: "other-1",
                    message: "Other message",
                    contacts: [],
                  },
                ],
              },
            },
          ],
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result.messages[0].topic).toBe("Other");
    });

    it("preserves all standard topic names", () => {
      const newData: EmergencyPlanData = {
        [mockPhoneNumber]: {
          language: "en",
          topics: [
            {
              "Child / Family Care": { messages: [{ message: "Test 1", contacts: [] }] },
              "Elderly Dependent Care": { messages: [{ message: "Test 2", contacts: [] }] },
              "Pet Care": { messages: [{ message: "Test 3", contacts: [] }] },
              "Work Absences": { messages: [{ message: "Test 4", contacts: [] }] },
              Other: { messages: [{ message: "Test 5", contacts: [] }] },
            },
          ],
        },
      };

      const result = transformToOldFormat(newData, mockPhoneNumber);

      expect(result.messages).toHaveLength(5);
      expect(result.messages.map((m) => m.topic)).toContain("Child / Family Care");
      expect(result.messages.map((m) => m.topic)).toContain("Elderly Dependent Care");
      expect(result.messages.map((m) => m.topic)).toContain("Pet Care");
      expect(result.messages.map((m) => m.topic)).toContain("Work Absences");
      expect(result.messages.map((m) => m.topic)).toContain("Other");
    });
  });

  describe("Round-trip transformations", () => {
    it("maintains data integrity through round-trip transformation", () => {
      const originalMessages: MessageData[] = [
        mockLegalMessage,
        mockPersonalMessage,
        mockTopicMessage,
      ];

      const oldData = { messages: originalMessages };
      const newFormat = transformToNewFormat(oldData, mockPhoneNumber);
      const backToOld = transformToOldFormat(newFormat, mockPhoneNumber);

      expect(backToOld.messages).toHaveLength(3);
      expect(backToOld.messages.find((m) => m.topic === "Legal Support")).toBeDefined();
      expect(backToOld.messages.find((m) => m.topic === "Personal Emergency")).toBeDefined();
      expect(backToOld.messages.find((m) => m.topic === "Child / Family Care")).toBeDefined();
    });

    it("preserves message content through round-trip", () => {
      const originalMessage: MessageData = {
        id: "test-1",
        topic: "Legal Support",
        message: "This is a test message with special chars: émojis 🚨",
        contacts: [
          {
            id: "contact-1",
            name: "José García",
            phoneNumber: "+15551234567",
          },
        ],
      };

      const oldData = { messages: [originalMessage] };
      const newFormat = transformToNewFormat(oldData, mockPhoneNumber);
      const backToOld = transformToOldFormat(newFormat, mockPhoneNumber);

      expect(backToOld.messages[0].message).toBe(originalMessage.message);
      expect(backToOld.messages[0].contacts[0].name).toBe(originalMessage.contacts[0].name);
    });

    it("handles multiple messages per category through round-trip", () => {
      const messages: MessageData[] = [
        { id: "1", topic: "Legal Support", message: "Legal 1", contacts: [] },
        { id: "2", topic: "Legal Support", message: "Legal 2", contacts: [] },
        { id: "3", topic: "Personal Emergency", message: "Personal 1", contacts: [] },
        { id: "4", topic: "Personal Emergency", message: "Personal 2", contacts: [] },
        { id: "5", topic: "Pet Care", message: "Pet 1", contacts: [] },
        { id: "6", topic: "Pet Care", message: "Pet 2", contacts: [] },
      ];

      const oldData = { messages };
      const newFormat = transformToNewFormat(oldData, mockPhoneNumber);
      const backToOld = transformToOldFormat(newFormat, mockPhoneNumber);

      expect(backToOld.messages).toHaveLength(6);
      expect(backToOld.messages.filter((m) => m.topic === "Legal Support")).toHaveLength(2);
      expect(backToOld.messages.filter((m) => m.topic === "Personal Emergency")).toHaveLength(2);
      expect(backToOld.messages.filter((m) => m.topic === "Pet Care")).toHaveLength(2);
    });
  });

  describe("Edge Cases", () => {
    it("handles messages with empty contacts array", () => {
      const messageWithNoContacts: MessageData = {
        id: "msg-1",
        topic: "Legal Support",
        message: "No contacts",
        contacts: [],
      };

      const oldData = { messages: [messageWithNoContacts] };
      const result = transformToNewFormat(oldData, mockPhoneNumber);

      expect(result[mockPhoneNumber].lawyerInfo?.messages[0].contacts).toEqual([]);
    });

    it("handles very long message text", () => {
      const longMessage: MessageData = {
        id: "msg-1",
        topic: "Legal Support",
        message: "A".repeat(5000),
        contacts: [],
      };

      const oldData = { messages: [longMessage] };
      const newFormat = transformToNewFormat(oldData, mockPhoneNumber);
      const backToOld = transformToOldFormat(newFormat, mockPhoneNumber);

      expect(backToOld.messages[0].message).toBe("A".repeat(5000));
    });

    it("handles special characters in phone numbers", () => {
      const message: MessageData = {
        id: "msg-1",
        topic: "Legal Support",
        message: "Test",
        contacts: [
          {
            id: "contact-1",
            name: "Test",
            phoneNumber: "+1 (555) 123-4567",
          },
        ],
      };

      const oldData = { messages: [message] };
      const newFormat = transformToNewFormat(oldData, mockPhoneNumber);
      const backToOld = transformToOldFormat(newFormat, mockPhoneNumber);

      expect(backToOld.messages[0].contacts[0].phoneNumber).toBe("+1 (555) 123-4567");
    });

    it("handles messages with very long contact names", () => {
      const message: MessageData = {
        id: "msg-1",
        topic: "Legal Support",
        message: "Test",
        contacts: [
          {
            id: "contact-1",
            name: "A".repeat(500),
            phoneNumber: "+15551234567",
          },
        ],
      };

      const oldData = { messages: [message] };
      const newFormat = transformToNewFormat(oldData, mockPhoneNumber);
      const backToOld = transformToOldFormat(newFormat, mockPhoneNumber);

      expect(backToOld.messages[0].contacts[0].name).toBe("A".repeat(500));
    });
  });
});

