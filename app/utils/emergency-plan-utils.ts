import type { MessageData } from "../components/MessageSetup";

// Define the new structure types
export interface Contact {
  id?: string;
  contactName: string;
  contactNumber: string;
}

export interface Message {
  id?: string;
  message: string;
  contacts: Contact[];
}

export interface MessageCategory {
  messages: Message[];
}

export type TopicCategory = Record<string, MessageCategory>;

export type EmergencyPlanData = Record<string, {
    lawyerInfo?: MessageCategory;
    basicEmergencyInfo?: MessageCategory;
    topics?: TopicCategory[];
    language: string;
  }>;

// Transform from old format to new format
export const transformToNewFormat = (
  oldData: { messages?: MessageData[] },
  userPhoneNumber: string,
  language = "en"
): EmergencyPlanData => {
  const newData: EmergencyPlanData = {
    [userPhoneNumber]: {
      language,
    },
  };

  // Ensure messages is an array
  const messages = Array.isArray(oldData.messages) ? oldData.messages : [];
  
  // Process Legal Support messages
  const legalMessages = messages.filter(msg => 
    msg.topic.includes("Legal Support")
  );
  
  if (legalMessages.length > 0 && newData[userPhoneNumber]) {
    newData[userPhoneNumber].lawyerInfo = {
      messages: legalMessages.map(msg => ({
        id: msg.id,
        message: msg.message,
        contacts: msg.contacts.map(contact => ({
          id: contact.id,
          contactName: contact.name,
          contactNumber: contact.phoneNumber
        }))
      }))
    };
  }

  // Process Personal Emergency messages
  const personalMessages = messages.filter(msg => 
    msg.topic.includes("Personal Emergency")
  );
  
  if (personalMessages.length > 0 && newData[userPhoneNumber]) {
    newData[userPhoneNumber].basicEmergencyInfo = {
      messages: personalMessages.map(msg => ({
        id: msg.id,
        message: msg.message,
        contacts: msg.contacts.map(contact => ({
          id: contact.id,
          contactName: contact.name,
          contactNumber: contact.phoneNumber
        }))
      }))
    };
  }

  // Process topic-based messages
  const topicMessages = messages.filter(msg => 
    !msg.topic.includes("Legal Support") && 
    !msg.topic.includes("Personal Emergency")
  );

  if (topicMessages.length > 0) {
    const topicCategories: TopicCategory = {};

    // Map topic names to keys
    const topicKeyMap: Record<string, string> = {
      "Child / Family Care": "Child / Family Care",
      "Elderly Dependent Care": "Elderly Dependent Care",
      "Pet Care": "Pet Care",
      "Work Absences": "Work Absences",
      "Other": "Other",
    };

    // Group messages by topic
    topicMessages.forEach(msg => {
      const topicKey = topicKeyMap[msg.topic] ?? msg.topic.toLowerCase().replace(/\s+/g, "");
      
      if (!topicCategories[topicKey]) {
        topicCategories[topicKey] = { messages: [] };
      }
      
      topicCategories[topicKey].messages.push({
        id: msg.id,
        message: msg.message,
        contacts: msg.contacts.map(contact => ({
          id: contact.id,
          contactName: contact.name,
          contactNumber: contact.phoneNumber
        }))
      });
    });

    if (newData[userPhoneNumber]) {
      newData[userPhoneNumber].topics = [topicCategories];
    }
  }

  return newData;
};

// Transform from new format back to old format (for compatibility)
export const transformToOldFormat = (
  newData: EmergencyPlanData,
  phoneNumber: string
): { messages: MessageData[] } => {
  const messages: MessageData[] = [];
  const userData = newData[phoneNumber];
  
  if (!userData) return { messages };

  // Process lawyer info
  if (userData.lawyerInfo?.messages) {
    userData.lawyerInfo.messages.forEach((msg, index) => {
      messages.push({
        id: msg.id || `legal-${Date.now()}-${index}`,
        topic: "Legal Support",
        message: msg.message,
        contacts: msg.contacts.map((contact, contactIndex) => ({
          id: contact.id || `contact-${Date.now()}-${index}-${contactIndex}`,
          name: contact.contactName,
          phoneNumber: contact.contactNumber
        }))
      });
    });
  }

  // Process basic emergency info
  if (userData.basicEmergencyInfo?.messages) {
    userData.basicEmergencyInfo.messages.forEach((msg, index) => {
      messages.push({
        id: msg.id || `personal-${Date.now()}-${index}`,
        topic: "Personal Emergency",
        message: msg.message,
        contacts: msg.contacts.map((contact, contactIndex) => ({
          id: contact.id || `contact-${Date.now()}-${index}-${contactIndex}`,
          name: contact.contactName,
          phoneNumber: contact.contactNumber
        }))
      });
    });
  }

  // Process topics
  if (userData.topics) {
    userData.topics.forEach(topicGroup => {
      Object.entries(topicGroup).forEach(([key, category]) => {
        // Map keys back to topic names
        const topicNameMap: Record<string, string> = {
          "Child / Family Care": "Child / Family Care",
          "Elderly Dependent Care": "Elderly Dependent Care",
          "Pet Care": "Pet Care",
          "Work Absences": "Work Absences",
          "Other": "Other",
          "other": "Other", // Also handle lowercase version for backwards compatibility
        };
        
        const topicName = topicNameMap[key] ?? key;
        
        category.messages.forEach((msg, index) => {
          messages.push({
            id: msg.id || `topic-${topicName}-${Date.now()}-${index}`,
            topic: topicName,
            message: msg.message,
            contacts: msg.contacts.map((contact, contactIndex) => ({
              id: contact.id || `contact-${Date.now()}-${index}-${contactIndex}`,
              name: contact.contactName,
              phoneNumber: contact.contactNumber
            }))
          });
        });
      });
    });
  }

  return { messages };
};

export default transformToNewFormat;
