import { AppLanguage } from "./app-settings";
import defaultMessagesTranslations from "../translations/default-messages.json";

// Function to get a default message by topic in the specified language
export const getDefaultMessageByTopic = (topic: string, language: AppLanguage = "en"): string => {
  // Map topic names to translation keys
  const topicToTranslationKey: Record<string, keyof typeof defaultMessagesTranslations.en> = {
    "Legal Support": "legalSupport",
    "Personal Emergency": "personalEmergency",
    "Child / Family Care": "childFamilyCare",
    "Elderly Dependent Care": "elderlyDependentCare",
    "Pet Care": "petCare",
    "Work Absences": "workAbsences",
    "Other": "other"
  };

  // Get the translation key for the given topic
  const translationKey = topicToTranslationKey[topic];

  // If no matching translation key, return empty string
  if (!translationKey) {
    return "";
  }

  // Get the message from the translations in the appropriate language
  const translations = defaultMessagesTranslations[language] || defaultMessagesTranslations.en;
  return translations[translationKey] || "";
};

// Keep the old DEFAULT_MESSAGES as a fallback in case there's an issue with translations
export const DEFAULT_MESSAGES = {
  "Legal Support": `Hello. This is your client [name]. I'm having an interaction with law enforcement and may be detained. This is an automated emergency alert.
My A-number: [A-number]
Emergency contact: [Name] at [phone number]. They have my important documents.
I need [medication] for my health.
Doctor: [Name/phone]
Medicaid #: [number]
Please tell authorities I need medication.
[Name] has my power of attorney: [contact info]`,

  "Personal Emergency": `Hello. This is [name]. I'm interacting with law enforcement and may be detained. This is an automated alert.
My A-number: [A-number]
Find me using ICE detention locator: https://locator.ice.gov/odls/#/search
(Note: locator may take 10 days to update)
My lawyer: [Name/phone]
Important documents: [location]
I need [medication] for my health.
Doctor: [Name/phone]
Medicaid #: [number]
Please notify authorities I need medication.`,

  "Child / Family Care": `Hello. This is [name]. I'm interacting with law enforcement and may be detained. This is an automated alert.
Childcare information:
Child [name]'s A-number: [A-number]
School: [school name]
Teacher: [name], Room [number]
Pickup time: [time]
Health info: [allergies/meds]
Medicaid #: [number]
Detailed care plan: [location]`,

  "Elderly Dependent Care": `Hello. This is [name]. I'm interacting with law enforcement and may be detained. This is an automated alert.
Care for [elderly name]:
Health info: [allergies/meds]
Medicare/Medicaid #: [number]
Detailed care plan: [location]`,

  "Pet Care": `Hello. This is [name]. I'm interacting with law enforcement and may be detained. This is an automated alert.
Pet care info:
[Pet name] is at [address]. Please pick them up.
Food location: [location]
Feeding: [amount], [frequency] times daily
Important note: [behavior]
Detailed care plan: [location]`,

  "Work Absences": `Hello. This is [name].
I'm having a personal emergency and can't come to work today.
For information about my absence: [contact name/phone]
This is an automated message from my emergency alert service.`,

  "Other": `Hello. This is [name]. I'm having an emergency situation.
This is an automated alert message.
[Add your custom message here]`
}; 

export default DEFAULT_MESSAGES;