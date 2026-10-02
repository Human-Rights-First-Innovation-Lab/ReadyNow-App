import { AppLanguage } from "../utils/app-settings";
import welcomeTranslations from "./welcome.json";
import aboutTranslations from "./about.json";
import howitworksTranslations from "./howitworks.json";
import privacyTranslations from "./privacy.json";
import createaccountTranslations from "./createaccount.json";
import beforeyoustart1Translations from "./beforeyoustart1.json";
import beforeyoustart2Translations from "./beforeyoustart2.json";
import planImportOptionTranslations from "./plan-import-option.json";
import emergencyPlanIntroTranslations from "./emergency-plan-intro.json";
import legalSupportQuestionTranslations from "./legal-support-question.json";
import legalSupportSetupTranslations from "./legal-support-setup.json";
import optionalLegalSupportTranslations from "./optional-legal-support.json";
import personalMessagesInfoTranslations from "./personal-messages-info.json";
import personalMessageSetupTranslations from "./personal-message-setup.json";
import additionalTopicsTranslations from "./additional-topics.json";
import topicMessageSetupTranslations from "./topic-message-setup.json";
import otpVerificationTranslations from "./otp-verification.json";
import messageSetupTranslations from "./message-setup.json";
import reviewTranslations from "./review.json";
import confirmationTranslations from "./confirmation.json";
import mainTranslations from "./main.json";
import faqTranslations from "./faq.json";
import feedbackTranslations from "./feedback.json";
import crashReportingTranslations from "./crash-reporting.json";
import alertButtonTranslations from "./alert-button.json";
import alertTabTranslations from "./alert-tab.json";
import defaultMessagesTranslations from "./default-messages.json";
import planTabTranslations from "./plan-tab.json";
import secureCopyTranslations from "./secure-copy.json";
import datePickerTranslations from "./date-picker.json";

// Define a type for welcome page translations
type WelcomeTranslations = {
  selectLanguage: string;
  spanishLabel: string;
  englishLabel: string;
  koreanLabel: string;
  frenchLabel: string;
  creoleLabel: string;
  chineseLabel: string;
  arabicLabel: string;
  dariLabel: string;
  pashtoLabel: string;
  continue: string;
  languagePlaceholder: string;
  readyNow: string;
  aboutApp: string;
};

// Define a type for about page translations
type AboutTranslations = {
  title: string;
  bePrepared: string;
  getPeaceOfMind: string;
  appDescription: string;
  contactsInfo: string;
  continue: string;
};

// Define a type for how it works page translations
type HowItWorksTranslations = {
  title: string;
  emergencyPlan: string;
  simplified: string;
  planTitle: string;
  planDescription: string;
  actTitle: string;
  actDescription: string;
  learnMore: string;
  visitFaq: string;
  continue: string;
};

// Define a type for privacy page translations
type PrivacyTranslations = {
  title: string;
  privacyMatters: string;
  personalInfoSharingConcern: string;
  dataConfidentiality: string;
  securityTip: string;
  securityTipText: string;
  learnMoreText: string;
  privacyPolicyLink: string;
  termsOfServiceLink: string;
  continue: string;
};

// Define a type for create account page translations
type CreateAccountTranslations = {
  title: string;
  login: string;
  securityInfo: string;
  noEmailPassword: string;
  enterPhone: string;
  phonePlaceholder: string;
  phoneValidationError: string;
  messageRates: string;
  termsAgreement: string;
  privacyPolicy: string;
  and: string;
  termsOfService: string;
  continue: string;
  sending: string;
  errorTitle: string;
  errorMessage: string;
  errorTitle2: string;
  errorMessage2: string;
  ok: string;
};

// Define a type for before you start page 1 translations
type BeforeYouStart1Translations = {
  title: string;
  assembleKeyDocuments: string;
  securityReason: string;
  cannotUpload: string;
  suggestion: string;
  gatherDocuments: string;
  location: string;
  consider: string;
  identityDocs: string;
  immigrationDocs: string;
  lengthOfStayDocs: string;
  accessImportant: string;
  includeAccess: string;
  onReadyNow: string;
  continue: string;
};

// Define a type for before you start page 2 translations
type BeforeYouStart2Translations = {
  title: string;
  locateANumber: string;
  aNumberDescription: string;
  whereToFind: string;
  whyImportant: string;
  continue: string;
};

type PlanImportOptionTranslations = {
  title: string;
  headline: string;
  description: string;
  descriptionBoldPart: string;
  createNewPlan: string;
  or: string;
  importLabel: string;
  importPlaceholder: string;
  importPlan: string;
  importingPlan: string;
  clearPlan: string;
  emptyPlanError: string;
  invalidPlanError: string;
  importFailedError: string;
};

// Define a type for emergency plan intro page translations
type EmergencyPlanIntroTranslations = {
  title: string;
  aboutYourPlan: string;
  planDescription: string;
  step1: string;
  step1Description: string;
  step2: string;
  step2Description: string;
  step3: string;
  step3Description: string;
  continue: string;
  emergencyPlan: string;
  legalSupport: string;
  personalSafetyMessage: string;
  additionalCare: string;
  workAbsences: string;
};

// Define a type for legal support question page translations
type LegalSupportQuestionTranslations = {
  title: string;
  legalSupport: string;
  question: string;
  example: string;
  yes: string;
  no: string;
  unknown: string;
  continue: string;
  selectionRequired: string;
  pleaseSelect: string;
  ok: string;
};

// Define a type for legal support setup page translations
type LegalSupportSetupTranslations = {
  title: string;
  legalSupport: string;
  createMessage: string;
  detainedInfo: string;
  recommendIncluding: string;
  legalName: string;
  emergencyContact: string;
  editSample: string;
  onlySentIf: string;
  addDifferentMessage: string;
  skip: string;
  saveAndContinue: string;
  deleteMessage: string;
  deleteConfirmation: string;
  errorSaving: string;
};

// Define a type for optional legal support page translations
type OptionalLegalSupportTranslations = {
  title: string;
  legalSupport: string;
  additionalLegalHelp: string;
  instructions: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
  skip: string;
  saveAndContinue: string;
  errorSaving: string;
  validationErrorTitle: string;
  validationErrorMessage: string;
  missingFields: string;
  requiredFields: string;
  ok: string;
  emergencyContactPhoneInvalid: string;
  emergencyContactNameInvalid: string;
  aNumberInvalid: string;
  emergencyContactEmailRequired: string;
  emergencyContactEmailInvalid: string;
  dateOfBirthRequired: string;
  dateOfBirthInvalidFormat: string;
  dateOfBirthTooYoung: string;
};

// Define a type for personal messages info page translations
type PersonalMessagesInfoTranslations = {
  title: string;
  personalEmergencyMessages: string;
  createMessages: string;
  additionalMessages: string;
  additionalMessagesBold: string;
  remember: string;
  messageInfo: string;
  continue: string;
};

// Define a type for personal message setup page translations
type PersonalMessageSetupTranslations = {
  title: string;
  personalSafetyMessages: string;
  createPersonalSafetyMessages: string;
  createPersonalSafetyMessagesBold: string;
  recommendIncluding: string;
  lawyerInfo: string;
  aNumberInfo: string;
  healthInfo: string;
  documentsInfo: string;
  editSample: string;
  onlySentIf: string;
  addAnotherMessage: string;
  skip: string;
  saveAndContinue: string;
  deleteMessage: string;
  deleteConfirmation: string;
  errorLoading: string;
  errorSaving: string;
  errorEmptyMessage: string;
  errorEmptyContact: string;
  errorDuplicateContact: string;
};

// Define a type for additional topics page translations
type AdditionalTopicsTranslations = {
  title: string;
  additionalMessages: string;
  setupCustomMessages: string;
  childcareBold: string;
  workAbsencesBold: string;
  selectTopics: string;
  selectTopicsBold: string;
  selectAllApply: string;
  loading: string;
  infoText: string;
  continue: string;
  skip: string;
  childCare: string;
  elderlyCare: string;
  petCare: string;
  workAbsences: string;
  other: string;
};

// Define a type for topic message setup page translations
type TopicMessageSetupTranslations = {
  title: string;
  loading: string;
  messagesTitle: string;
  wantedToCreate: string;
  recommendedInfo: string;
  workAbsencesInfo: string;
  childCareInfo1: string;
  childCareInfo2: string;
  childCareInfo4: string;
  childCareInfo5: string;
  elderlyCareInfo1: string;
  elderlyCareInfo2: string;
  elderlyCareInfo3: string;
  elderlyCareInfo4: string;
  petCareInfo1: string;
  petCareInfo2: string;
  petCareInfo3: string;
  petCareInfo4: string;
  petCareInfo5: string;
  workAbsencesInfo1: string;
  editSample: string;
  onlySentIf: string;
  addAnotherMessage: string;
  skip: string;
  saveAndContinue: string;
  errorTitle: string;
  errorEmptyMessage: string;
  errorEmptyContact: string;
  errorDuplicateContact: string;
  errorSaving: string;
  deleteTitle: string;
  deleteConfirmation: string;
  cancel: string;
  delete: string;
  ok: string;
  close: string;
  schoolReminderTitle: string;
  schoolReminderMessage: string;
};

// Define a type for OTP verification page translations
type OtpVerificationTranslations = {
  title: string;
  enterCode: string;
  sentCode: string;
  requestNewIn: string;
  requestNewNow: string;
  resendCode: string;
  continue: string;
  verifying: string;
  invalidCode: string;
  pleaseEnter: string;
  newCodeSent: string;
};

// Define a type for MessageSetup component translations
type MessageSetupTranslations = {
  message: string;
  contacts: string;
  contactsHelp: string;
  name: string;
  phonePrefix: string;
  phoneNumber: string;
  addContact: string;
  addFromContacts: string;
  duplicateContactTitle: string;
  duplicateContactMessage: string;
  editSampleMessage: string;
  deleteMessage: string;
  recipients: string;
  done: string;
};

// Define a type for Review page translations
type ReviewTranslations = {
  title: string;
  reviewYourPlan: string;
  carefullyReview: string;
  carefullyReviewBold: string;
  typosOrIncorrect: string;
  editLater: string;
  loading: string;
  noMessagesYet: string;
  createMessages: string;
  noMessages: string;
  optionalLegalSupport: string;
  noLegalInfo: string;
  addLegalInfo: string;
  updateLegalInfo: string;
  saveAndContinue: string;
  deleteMessage: string;
  deleteConfirmation: string;
  cancel: string;
  delete: string;
  ok: string;
  errorTitle: string;
  errorLoading: string;
  errorUpdating: string;
  errorDeleting: string;
  errorSaving: string;
  planSavedTitle: string;
  planSavedMessage1: string;
  planSavedMessage2: string;
  close: string;
};

// Define a type for confirmation page translations
type ConfirmationTranslations = {
  title: string;
  messagePlanSaved: string;
  alertWillSend: string;
  okay: string;
  giveHeadsUp: string;
  letContactsKnow: string;
  alertsSource: string;
  suggestedMessage: string;
  copyMessage: string;
  copied: string;
  readyNowWillSend: string;
  msgDataRates: string;
  confirmPermission: string;
  sendSmsInvitation: string;
  predefinedMessage: string;
};

// Define a type for main page translations
type CrashReportingTranslations = {
  title: string;
  heading: string;
  intro: string;
  whatWeSend: string;
  sendItem1: string;
  sendItem2: string;
  sendItem3: string;
  whatWeNeverSend: string;
  neverItem1: string;
  neverItem2: string;
  neverItem3: string;
  neverItem4: string;
  yourChoice: string;
  accept: string;
  decline: string;
  settingsSection: string;
  settingsOn: string;
  settingsOff: string;
  turnOn: string;
  turnOff: string;
};

// Define a type for main page translations
type MainTranslations = {
  readyNow: string;
  emergencyPlan: string;
  faq: string;
  feedback: string;
  settings: string;
  saving: string;
  saved: string;
  deleteEmergencyPlan: string;
  deleteConfirmation: string;
  cancel: string;
  yesDelete: string;
  emergencyPlanDeleted: string;
  planDeletedMessage: string;
  createEmergencyPlan: string;
  signOut: string;
  signOutConfirmation: string;
  deleteMessage: string;
  deleteMessageConfirmation: string;
  delete: string;
  success: string;
  legalSupportSaved: string;
  ok: string;
  error: string;
  navAlert: string;
  navPlan: string;
  navFaq: string;
  navFeedback: string;
  navSettings: string;
  settingsTitle: string;
  languageSection: string;
  selectLanguage: string;
  selectLanguagePlaceholder: string;
  accountSection: string;
  notificationSection: string;
  notificationDescription: string;
  enableNotifications: string;
  disableNotifications: string;
  refreshNotifications: string;
  notificationsStatusEnabled: string;
  notificationsStatusDisabled: string;
  notificationsStatusPending: string;
  notificationsStatusError: string;
  notificationsPermissionDenied: string;
  notificationsRegistrationFailed: string;
  notificationsDisableFailed: string;
  notificationsBiometricFailed: string;
  notificationsConfigMissing: string;
  demoModalTitle: string;
  demoModalContent: string;
  tryDemo: string;
  tryDemoSection: string;
  skipForNow: string;
  demoCompleteTitle: string;
  demoCompleteContentTitle: string;
  demoCompleteContent1: string;
  demoCompleteContent2: string;
  demoCompleteContent3: string;
  demoCompleteReminder: string;
  demoCompleteReminderText: string;
  gotIt: string;
  tryAgain: string;
  enablePushNotifications: string;
  pushNotificationDescription: string;
  notificationEnabledSuccess: string;
  notificationEnableFailed: string;
};

// Define a type for FAQ translations
type FAQTranslations = {
  title: string;
  developerQuestion: string;
  developerAnswer: string;
  purposeQuestion: string;
  purposeAnswer: string;
  dataProtectionQuestion: string;
  dataProtectionAnswer: string;
  dataProtectionAdditional: string;
  iceAccessQuestion: string;
  iceAccessAnswer: string;
  accidentalPressQuestion: string;
  accidentalPressAnswer: string;
  documentsQuestion: string;
  documentsAnswer: string;
  documentsListItem1: string;
  documentsListItem2: string;
  documentsListItem3: string;
  documentsListItem4: string;
  documentsListItem5: string;
  documentsListItem6: string;
  nilraQuestion: string;
  nilraAnswer: string;
  nilraHelpQuestion: string;
  nilraHelpAnswer: string;
  nilraHelpAdditional: string;
};

// Define a type for AlertButton translations
type AlertButtonTranslations = {
  sendAlert: string;
  sendingAlert: string;
  emergencyMessagesSent: string;
  cancelAlert: string;
  alertCancelled: string;
  alertCancelledMessage: string;
  close: string;
  alertSent: string;
  alertSentMessage: string;
  pressedByAccident: string;
  accidentalButtonPress: string;
  accidentalMessage: string;
  emailNilra: string;
  dailyLimitReached: string;
  dailyLimitMessage: string;
  understand: string;
  processingAlert: string;
  validationErrorTitle: string;
  validationErrorMessage: string;
  ok: string;
  emergencyMessagesSentDemo: string;
  practiceCancelling: string;
  deliveryFailed: string;
};

// Define a type for AlertTab translations
type AlertTabTranslations = {
  pressAndHold: string;
  pressAndHoldDemo: string;
  notice: string;
  securityPurposes: string;
  securityPurposesDemo: string;
  demoModeLabel: string;
};

// Define a type for DefaultMessages translations
type DefaultMessagesTranslations = {
  legalSupport: string;
  personalEmergency: string;
  childFamilyCare: string;
  elderlyDependentCare: string;
  petCare: string;
  workAbsences: string;
  other: string;
};

// Define a type for plan tab translations
type PlanTabTranslations = {
  loading: string;
  noPlanYet: string;
  createEmergencyPlan: string;
  yourEmergencyPlan: string;
  addFirst: string;
  add: string;
  message: string;
  legalSupportTitle: string;
  noLegalSupport: string;
  addLegalSupportInfo: string;
  updateLegalSupportInfo: string;
  copyPlanToClipboard: string;
  planCopied: string;
  deleteMyEmergencyPlan: string;
  messageFormat: string;
  personalEmergency: string;
  legalSupport: string;
  childFamilyCare: string;
  elderlyDependentCare: string;
  petCare: string;
  workAbsences: string;
  other: string;
};

// Define a type for secure copy translations
type SecureCopyTranslations = {
  header: string;
  title: string;
  recommendation: string;
  instructionsTitle: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  yourPlan: string;
  copyPlan: string;
  copied: string;
  continue: string;
  skip: string;
  loading: string;
  errorLoadingPlan: string;
  noPlanData: string;
  planIntroMessage: string;
  myEmergencyPlan: string;
  message: string;
  messageContent: string;
  contacts: string;
  noContacts: string;
  generatedBy: string;
  keepSafe: string;
  shareInstructions: string;
};

// Define a type for date picker translations
type DatePickerTranslations = {
  cancel: string;
  selectDate: string;
  done: string;
  selectDatePlaceholder: string;
};

// Define a type for feedback translations
type FeedbackTranslations = {
  title: string;
  subtitle: string;
  question1: string;
  placeholder1: string;
  question2: string;
  placeholder2: string;
  question3: string;
  placeholder3: string;
  question4: string;
  placeholder4: string;
  submitButton: string;
  submitting: string;
  footerText: string;
  noFeedbackTitle: string;
  noFeedbackMessage: string;
  thankYouTitle: string;
  thankYouMessage: string;
  errorTitle: string;
  errorMessage: string;
  ok: string;
  close: string;
};

// Define a type for all translation files
type TranslationFiles = {
  welcome: Record<AppLanguage, WelcomeTranslations>;
  about: Record<AppLanguage, AboutTranslations>;
  howitworks: Record<AppLanguage, HowItWorksTranslations>;
  privacy: Record<AppLanguage, PrivacyTranslations>;
  createaccount: Record<AppLanguage, CreateAccountTranslations>;
  beforeyoustart1: Record<AppLanguage, BeforeYouStart1Translations>;
  beforeyoustart2: Record<AppLanguage, BeforeYouStart2Translations>;
  "plan-import-option": Record<AppLanguage, PlanImportOptionTranslations>;
  "emergency-plan-intro": Record<AppLanguage, EmergencyPlanIntroTranslations>;
  "legal-support-question": Record<AppLanguage, LegalSupportQuestionTranslations>;
  "legal-support-setup": Record<AppLanguage, LegalSupportSetupTranslations>;
  "optional-legal-support": Record<AppLanguage, OptionalLegalSupportTranslations>;
  "personal-messages-info": Record<AppLanguage, PersonalMessagesInfoTranslations>;
  "personal-message-setup": Record<AppLanguage, PersonalMessageSetupTranslations>;
  "additional-topics": Record<AppLanguage, AdditionalTopicsTranslations>;
  "topic-message-setup": Record<AppLanguage, TopicMessageSetupTranslations>;
  "otp-verification": Record<AppLanguage, OtpVerificationTranslations>;
  "message-setup": Record<AppLanguage, MessageSetupTranslations>;
  "review": Record<AppLanguage, ReviewTranslations>;
  "confirmation": Record<AppLanguage, ConfirmationTranslations>;
  "main": Record<AppLanguage, MainTranslations>;
  "faq": Record<AppLanguage, FAQTranslations>;
  "feedback": Record<AppLanguage, FeedbackTranslations>;
  "crash-reporting": Record<AppLanguage, CrashReportingTranslations>;
  "alert-button": Record<AppLanguage, AlertButtonTranslations>;
  "alert-tab": Record<AppLanguage, AlertTabTranslations>;
  "default-messages": Record<AppLanguage, DefaultMessagesTranslations>;
  "plan-tab": Record<AppLanguage, PlanTabTranslations>;
  "secure-copy": Record<AppLanguage, SecureCopyTranslations>;
  "date-picker": Record<AppLanguage, DatePickerTranslations>;
};

// Create a mapping of translation keys for each page
export type TranslationKeys = {
  welcome: keyof WelcomeTranslations;
  about: keyof AboutTranslations;
  howitworks: keyof HowItWorksTranslations;
  privacy: keyof PrivacyTranslations;
  createaccount: keyof CreateAccountTranslations;
  beforeyoustart1: keyof BeforeYouStart1Translations;
  beforeyoustart2: keyof BeforeYouStart2Translations;
  "plan-import-option": keyof PlanImportOptionTranslations;
  "emergency-plan-intro": keyof EmergencyPlanIntroTranslations;
  "legal-support-question": keyof LegalSupportQuestionTranslations;
  "legal-support-setup": keyof LegalSupportSetupTranslations;
  "optional-legal-support": keyof OptionalLegalSupportTranslations;
  "personal-messages-info": keyof PersonalMessagesInfoTranslations;
  "personal-message-setup": keyof PersonalMessageSetupTranslations;
  "additional-topics": keyof AdditionalTopicsTranslations;
  "topic-message-setup": keyof TopicMessageSetupTranslations;
  "otp-verification": keyof OtpVerificationTranslations;
  "message-setup": keyof MessageSetupTranslations;
  "review": keyof ReviewTranslations;
  "confirmation": keyof ConfirmationTranslations;
  "main": keyof MainTranslations;
  "faq": keyof FAQTranslations;
  "feedback": keyof FeedbackTranslations;
  "crash-reporting": keyof CrashReportingTranslations;
  "alert-button": keyof AlertButtonTranslations;
  "alert-tab": keyof AlertTabTranslations;
  "default-messages": keyof DefaultMessagesTranslations;
  "plan-tab": keyof PlanTabTranslations;
  "secure-copy": keyof SecureCopyTranslations;
  "date-picker": keyof DatePickerTranslations;
};

// Define a mapping of pages to their translation files
const translationFiles: TranslationFiles = {
  welcome: welcomeTranslations as Record<AppLanguage, WelcomeTranslations>,
  about: aboutTranslations as Record<AppLanguage, AboutTranslations>,
  howitworks: howitworksTranslations as Record<AppLanguage, HowItWorksTranslations>,
  privacy: privacyTranslations as Record<AppLanguage, PrivacyTranslations>,
  createaccount: createaccountTranslations as Record<AppLanguage, CreateAccountTranslations>,
  beforeyoustart1: beforeyoustart1Translations as Record<AppLanguage, BeforeYouStart1Translations>,
  beforeyoustart2: beforeyoustart2Translations as Record<AppLanguage, BeforeYouStart2Translations>,
  "plan-import-option": planImportOptionTranslations as any,
  "emergency-plan-intro": emergencyPlanIntroTranslations as Record<AppLanguage, EmergencyPlanIntroTranslations>,
  "legal-support-question": legalSupportQuestionTranslations as Record<AppLanguage, LegalSupportQuestionTranslations>,
  "legal-support-setup": legalSupportSetupTranslations as any,
  "optional-legal-support": optionalLegalSupportTranslations as any,
  "personal-messages-info": personalMessagesInfoTranslations as any,
  "personal-message-setup": personalMessageSetupTranslations as any,
  "additional-topics": additionalTopicsTranslations as any,
  "topic-message-setup": topicMessageSetupTranslations as any,
  "otp-verification": otpVerificationTranslations as Record<AppLanguage, OtpVerificationTranslations>,
  "message-setup": messageSetupTranslations as any,
  "review": reviewTranslations as any,
  "confirmation": confirmationTranslations as any,
  "main": mainTranslations as any,
  "faq": faqTranslations as any,
  "feedback": feedbackTranslations as any,
  "crash-reporting": crashReportingTranslations satisfies Record<AppLanguage, CrashReportingTranslations>,
  "alert-button": alertButtonTranslations as any,
  "alert-tab": alertTabTranslations as any,
  "default-messages": defaultMessagesTranslations as any,
  "plan-tab": planTabTranslations as any,
  "secure-copy": secureCopyTranslations as any,
  "date-picker": datePickerTranslations as Record<AppLanguage, DatePickerTranslations>
};

/**
 * Get a translation for a specific key in a specific page
 * @param page The page to get translations for
 * @param language The language to get translations in
 * @param key The translation key
 * @returns The translated string
 */
export const getTranslation = <P extends keyof TranslationFiles>(
  page: P,
  language: AppLanguage,
  key: TranslationKeys[P]
): string => {
  const translationFile = translationFiles[page];
  if (!translationFile) {
    console.error(`Translation file for ${String(page)} not found`);
    return String(key);
  }

  const langTranslations = translationFile[language];
  if (!langTranslations) {
    console.error(`Translations for language ${language} not found in ${String(page)}`);
    const fallback = translationFile.en?.[key as keyof typeof translationFile.en];
    return fallback || String(key);
  }

  const translation = langTranslations[key as keyof typeof langTranslations];
  if (!translation) {
    console.error(`Translation for key ${String(key)} not found in ${String(page)}/${language}`);
    const fallback = translationFile.en?.[key as keyof typeof translationFile.en];
    return fallback || String(key);
  }

  return translation;
};

/**
 * Hook to get translations for a specific page
 * @param page The page to get translations for
 * @param language The language to get translations in
 * @returns An object with a t function to get translations
 */
export const usePageTranslation = <P extends keyof TranslationFiles>(
  page: P,
  language: AppLanguage
) => {
  const t = (key: TranslationKeys[P]): string => {
    return getTranslation(page, language, key);
  };

  return { t };
}; 

export default getTranslation;