import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Switch,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Sentry from "@sentry/react-native";

import Button from "./Button";
import { CustomPicker } from "./Picker";
import { DatePicker } from "./DatePicker";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";
import { validateANumber } from "../services/nilra-api";
import { EnhancedTextInput } from "./EnhancedTextInput";
import { fetchCountries } from "../utils/countries-api";
import { validateDateOfBirth } from "../utils/date-validation";

export interface LegalSupportData {
  firstName: string;
  middleName: string;
  lastName: string;
  aNumber: string;
  countryOfBirth: string;
  dateOfBirth: string; // ISO date string (YYYY-MM-DD)
  hasImmigrationAttorney: string; // "Yes", "No", "Unknown"
  immigrationAttorneyNotes: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactEmail: string;
  emergencyContactPhone: string;
  canContactEmergencyContact: boolean;
  enableLocationSharing: boolean;
  canHRFContact: boolean;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    timestamp?: number;
  };
}

interface LegalSupportFormProps {
  initialData?: Partial<LegalSupportData>;
  onSave: (data: LegalSupportData) => void;
  onSkip?: () => void;
  saveButtonText?: string;
  showSkipButton?: boolean;
  showTitle?: boolean;
  showExplanatoryText?: boolean;
  hideButtons?: boolean;
  translations?: {
    additionalLegalHelp?: string;
    instructions?: string;
    nameLabel?: string;
    namePlaceholder?: string;
    phoneLabel?: string;
    phonePlaceholder?: string;
    emailLabel?: string;
    emailPlaceholder?: string;
    notesLabel?: string;
    notesPlaceholder?: string;
    skip?: string;
    validationErrorTitle?: string;
    validationErrorMessage?: string;
    ok?: string;
    missingFields?: string;
    requiredFields?: string;
    emergencyContactNameInvalid?: string;
    emergencyContactPhoneInvalid?: string;
    aNumberInvalid?: string;
    emergencyContactEmailRequired?: string;
    emergencyContactEmailInvalid?: string;
  };
}

const DEFAULT_FORM_DATA: LegalSupportData = {
  firstName: "",
  middleName: "",
  lastName: "",
  aNumber: "",
  countryOfBirth: "",
  dateOfBirth: "", // Today's date in ISO format (YYYY-MM-DD)
  hasImmigrationAttorney: "Unknown",
  immigrationAttorneyNotes: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactEmail: "",
  emergencyContactPhone: "",
  canContactEmergencyContact: true,
  enableLocationSharing: true,
  canHRFContact: true,
};

export const LegalSupportForm: React.FC<LegalSupportFormProps> = ({
  initialData = {},
  onSave,
  onSkip,
  saveButtonText = "Save & Continue",
  showSkipButton = true,
  showTitle = true,
  showExplanatoryText = true,
  hideButtons = false,
  translations,
}) => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("optional-legal-support", settings.language);
  const { t: alertT } = usePageTranslation("alert-button", settings.language);

  // Get translations either from props or from the translation system
  const getTranslation = (key: string, defaultValue: string): string => {
    if (translations && translations[key as keyof typeof translations]) {
      return translations[key as keyof typeof translations] || defaultValue;
    }
    try {
      return t(key as any) || defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [formData, setFormData] = useState<LegalSupportData>(() => ({
    ...DEFAULT_FORM_DATA,
    ...initialData,
    canHRFContact: true, // Always true - checkbox removed from UI
  }));

  // Track form validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Track if we have location permission
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  // State for managing custom modal
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  // State for countries list
  const [countries, setCountries] = useState<string[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  // State for auto-save indicator
  const [showAutoSaveIndicator, setShowAutoSaveIndicator] = useState(false);

  // Ref to track when we should auto-save after dateOfBirth changes
  // Initialized to false to prevent auto-save on component mount or initial data load
  const shouldAutoSaveDateOfBirth = useRef(false);

  // Method to show the custom modal
  const showCustomModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setShowModal(true);
  };

  // Auto-save to SecureStore on blur for data persistence
  const autoSaveToStorage = useCallback(async (updatedData: LegalSupportData) => {
    try {
      await SecureStore.setItemAsync(
        "additionalLegalHelp_draft",
        JSON.stringify(updatedData)
      );

      // Show brief auto-save indicator
      setShowAutoSaveIndicator(true);
      setTimeout(() => setShowAutoSaveIndicator(false), 2000);
    } catch (error) {
      console.error("Error auto-saving legal support draft:", error);
      // Don't throw - auto-save is a best-effort feature
    }
  }, []);

  // Update formData when initialData prop changes (e.g., when parent loads draft)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        canHRFContact: true,
      }));
    }
  }, [initialData]);

  // Fetch countries list on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const countriesList = await fetchCountries();
        setCountries(countriesList);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: "LegalSupportForm",
            action: "fetch_countries",
          },
          level: "error",
        });
        // Keep empty array as fallback
      } finally {
        setLoadingCountries(false);
      }
    };

    void loadCountries();
  }, []);

  // Auto-save when dateOfBirth changes (after user selection)
  // formData is intentionally not in the deps array - when dateOfBirth changes, 
  // formData has already changed, so the effect captures the updated value in the closure
  useEffect(() => {
    if (shouldAutoSaveDateOfBirth.current) {
      shouldAutoSaveDateOfBirth.current = false;
      void autoSaveToStorage(formData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.dateOfBirth, autoSaveToStorage]);

  // Request location permission when location sharing is enabled
  useEffect(() => {
    if (formData.enableLocationSharing && !hasLocationPermission) {
      void requestLocationPermission();
    }
  }, [formData.enableLocationSharing, hasLocationPermission]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        showCustomModal(
          "Permission Denied",
          "Location permission is needed to share your location. You can enable it in your device settings."
        );
        // Turn off location sharing if permission denied
        setFormData((prev) => ({
          ...prev,
          enableLocationSharing: false,
        }));
        return;
      }

      setHasLocationPermission(true);
      // Don't call getLocation() here - we'll get it only when the alert button is pressed
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error requesting location permission:", error.message);
        showCustomModal("Error", "Could not request location permission");
      } else {
        console.error("Unknown error requesting location permission:", error);
        showCustomModal("Error", "Could not request location permission");
      }
    }
  };

  const handleInputChange = (
    field: keyof LegalSupportData,
    value: string | boolean
  ) => {
    // Handle A-Number special case
    if (field === "aNumber" && typeof value === "string") {
      // Remove all non-numeric characters
      const numericValue = value.replace(/[^0-9]/g, "");

      // Limit to 9 digits
      const truncatedValue = numericValue.slice(0, 9);

      const updatedData = {
        ...formData,
        [field]: truncatedValue,
      };
      setFormData(updatedData);

      // Call onSave with updated data if hideButtons is true
      if (hideButtons) {
        // For API submission, send null if A-number is empty or invalid
        const dataToSave = {
          ...updatedData,
          aNumber: truncatedValue.trim() ? truncatedValue : "",
          canContactEmergencyContact: true,
        };
        onSave(dataToSave);
      }
      return;
    }

    // Handle phone number special case
    if (field === "emergencyContactPhone" && typeof value === "string") {
      // Remove all non-numeric characters
      const numericValue = value.replace(/[^0-9]/g, "");

      // Limit to 10 digits
      const truncatedValue = numericValue.slice(0, 10);

      const updatedData = {
        ...formData,
        [field]: truncatedValue,
      };
      setFormData(updatedData);

      // Call onSave with updated data if hideButtons is true (for parent component to track changes)
      if (hideButtons) {
        onSave(updatedData);
      }
      return;
    }

    const updatedData = {
      ...formData,
      [field]: value,
    };
    setFormData(updatedData);

    // Call onSave with updated data if hideButtons is true (for parent component to track changes)
    if (hideButtons) {
      const dataToSave = {
        ...updatedData,
        // Leave A-number as empty string if not provided - parent will handle null conversion
        aNumber: updatedData.aNumber.trim(),
        // Always set canContactEmergencyContact to true
        canContactEmergencyContact: true,
      };
      onSave(dataToSave);
    }
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    // Required fields validation
    if (!formData.firstName.trim()) {
      errors.push(getTranslation("firstNamePlaceholder", "First Name"));
    }

    if (!formData.lastName.trim()) {
      errors.push(getTranslation("lastNamePlaceholder", "Last Name"));
    }

    // Date of birth validation
    const dateValidation = validateDateOfBirth(formData.dateOfBirth);
    if (!dateValidation.isValid) {
      if (dateValidation.error === "empty") {
        errors.push(getTranslation("dateOfBirthRequired", "Date of birth is required"));
      } else if (dateValidation.error === "invalidFormat") {
        errors.push(
          getTranslation(
            "dateOfBirthInvalidFormat",
            "Please enter a valid date"
          )
        );
      } else if (dateValidation.error === "tooYoung") {
        errors.push(
          getTranslation(
            "dateOfBirthTooYoung",
            "You must be at least 5 years old"
          )
        );
      } else {
        // Fallback to required message if error type is unknown
        errors.push(getTranslation("dateOfBirthRequired", "Date of birth is required"));
      }
    }

    // A-Number is now optional - only validate if provided
    if (formData.aNumber.trim() && !validateANumber(formData.aNumber)) {
      // Validate A-Number format only if it's provided
      errors.push(
        getTranslation(
          "aNumberInvalid",
          "A-Number must be 9 digits and cannot be all zeros, ones, or sequential"
        )
      );
    }

    if (!formData.emergencyContactName.trim()) {
      errors.push(
        getTranslation(
          "emergencyContactNamePlaceholder",
          "Emergency Contact Name"
        )
      );
    } else {
      // Check if emergency contact name has both first and last name
      const nameParts = formData.emergencyContactName.trim().split(/\s+/);
      if (nameParts.length < 2) {
        errors.push(
          getTranslation(
            "emergencyContactNameInvalid",
            "Please enter both first name and last name"
          )
        );
      }
    }

    // Phone number validation
    if (!formData.emergencyContactPhone.trim()) {
      errors.push(
        getTranslation(
          "emergencyContactPhonePlaceholder",
          "Emergency Contact Phone"
        )
      );
    } else if (formData.emergencyContactPhone.length < 10) {
      errors.push(
        getTranslation(
          "emergencyContactPhoneInvalid",
          "Phone number must be 10 digits"
        )
      );
    }

    // Email validation - always required based on API requirements
    if (!formData.emergencyContactEmail.trim()) {
      errors.push(getTranslation("emergencyContactEmailPlaceholder", "Email"));
    } else {
      // Basic email validation if email is provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.emergencyContactEmail.trim())) {
        errors.push(
          getTranslation(
            "emergencyContactEmailInvalid",
            "Please enter a valid email address"
          )
        );
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSaveForm = async () => {
    // Validate the form first
    if (!validateForm()) {
      setShowValidationModal(true);
      return;
    }

    // Remove location from what we're saving - we'll get it only when alert button is pressed
    const dataToSave = {
      ...formData,
      // Leave A-number as empty string if not provided - parent will handle null conversion for API
      aNumber: formData.aNumber.trim(),
      // Always set canContactEmergencyContact to true
      canContactEmergencyContact: true,
      location: undefined, // Don't save location now
    };

    // Clear the draft after successful save
    try {
      await SecureStore.deleteItemAsync("additionalLegalHelp_draft");
    } catch (error) {
      // Non-critical error
      console.error("Error clearing draft:", error);
    }

    // Call the onSave function passed as a prop
    onSave(dataToSave);
  };

  // Inside your component, add this array for the picker options
  const yesNoOptions = [
    { label: "Yes", value: "yes" },
    { label: "No", value: "no" },
  ];

  const openNILRAWebsite = () => {
    Linking.openURL("https://nilra.org/");
  };

  // Add this new function to dismiss keyboard when tapping outside inputs
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <View className="flex-1 justify-between">
        <View>
          {/* Auto-save indicator */}
          {showAutoSaveIndicator && (
            <View className="mb-2 rounded-lg bg-green-100 px-4 py-2">
              <Text className="text-center text-sm text-green-700">
                ✓ {getTranslation("autoSaved", "Progress saved")}
              </Text>
            </View>
          )}

          {showTitle && (
            <Text className="mb-6 text-center text-3xl font-bold text-gray-700">
              {getTranslation("title", "Optional Legal Support")}
            </Text>
          )}

          {showExplanatoryText && (
            <View className="my-4">
              <Text className="p-4 text-lg">
                {getTranslation(
                  "explanatoryText1",
                  "In the event you are detained and do not already have an immigration attorney, would you like us to share information with the"
                )}
                <Text
                  onPress={openNILRAWebsite}
                  className="text-blue-600 underline"
                >
                  {" "}{getTranslation(
                    "NILRAWebsite",
                    "National Immigration Legal Responders Alliance (NILRA)"
                  )}{" "}
                </Text>
                {getTranslation(
                  "explanatoryText2",
                  "to help connect you with a removal defense lawyer? Human Rights First is a member of the NILRA network."
                )}
              </Text>
              <Text className="p-4 text-lg">
                {getTranslation(
                  "optInText",
                  "By providing the following information, you are opt-ing in for legal services referral."
                )}
              </Text>
              <Text className="px-4 pb-4 text-base text-gray-700 font-medium">
                {getTranslation(
                  "accuracyImportant",
                  "Please ensure this information is as accurate and complete as possible. It is critical for matching you with legal support."
                )}
              </Text>
            </View>
          )}

          <View className="rounded-xl border border-gray-300 p-2 bg-gray-100">
            <Text className="mb-4 text-center text-lg font-bold text-gray-700">
              {getTranslation("yourInformation", "Your Information")}
            </Text>

            <View className="mb-4">
              <View className="flex-row items-center">
                <Text className="text-base text-red-500 mr-1">*</Text>
                <EnhancedTextInput
                  className={`flex-1 rounded-md border ${validationErrors.includes(
                    getTranslation("firstNamePlaceholder", "First Name")
                  )
                    ? "border-red-500"
                    : "border-gray-300"
                    } bg-white p-3 text-black`}
                  value={formData.firstName}
                  onChangeText={(text) => handleInputChange("firstName", text)}
                  onBlur={() => autoSaveToStorage(formData)}
                  placeholder={getTranslation(
                    "firstNamePlaceholder",
                    "First Name"
                  )}
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                  blurOnSubmit={Platform.OS === "ios"}
                  doneButtonText={getTranslation("done", "Done")}
                />
              </View>
            </View>

            <View className="mb-4">
              <EnhancedTextInput
                className="w-full rounded-md border border-gray-300 bg-white p-3 text-black"
                value={formData.middleName}
                onChangeText={(text) => handleInputChange("middleName", text)}
                onBlur={() => autoSaveToStorage(formData)}
                placeholder={getTranslation(
                  "middleNamePlaceholder",
                  "Middle Name (optional)"
                )}
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
                blurOnSubmit={Platform.OS === "ios"}
                doneButtonText={getTranslation("done", "Done")}
              />
            </View>

            <View className="mb-4">
              <View className="flex-row items-center">
                <Text className="text-base text-red-500 mr-1">*</Text>
                <EnhancedTextInput
                  className={`flex-1 rounded-md border ${validationErrors.includes(
                    getTranslation("lastNamePlaceholder", "Last Name")
                  )
                    ? "border-red-500"
                    : "border-gray-300"
                    } bg-white p-3 text-black`}
                  value={formData.lastName}
                  onChangeText={(text) => handleInputChange("lastName", text)}
                  onBlur={() => autoSaveToStorage(formData)}
                  placeholder={getTranslation(
                    "lastNamePlaceholder",
                    "Last Name"
                  )}
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                  blurOnSubmit={Platform.OS === "ios"}
                  doneButtonText={getTranslation("done", "Done")}
                />
              </View>
            </View>

            <View className="mb-4">
              <EnhancedTextInput
                className={`w-full rounded-md border ${validationErrors.includes(
                  getTranslation(
                    "aNumberInvalid",
                    "A-Number must be 9 digits and cannot be all zeros, ones, or sequential"
                  )
                )
                  ? "border-red-500"
                  : "border-gray-300"
                  } bg-white p-3 text-black`}
                value={formData.aNumber}
                onChangeText={(text) => handleInputChange("aNumber", text)}
                onBlur={() => autoSaveToStorage(formData)}
                placeholder={getTranslation("aNumberPlaceholder", "A-Number (optional)")}
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                returnKeyType="done"
                blurOnSubmit={Platform.OS === "ios"}
                doneButtonText={getTranslation("done", "Done")}
              />
            </View>

            <View className="mb-8">
              {loadingCountries ? (
                <View className="w-full rounded-md border border-gray-300 bg-gray-100 p-3">
                  <Text className="text-gray-500">
                    {getTranslation("loadingCountries", "Loading countries...")}
                  </Text>
                </View>
              ) : (
                <CustomPicker
                  selectedValue={formData.countryOfBirth}
                  onValueChange={(value) =>
                    handleInputChange("countryOfBirth", value)
                  }
                  items={countries.map((country) => ({
                    label: country,
                    value: country,
                  }))}
                  placeholder={getTranslation(
                    "countryOfBirthPlaceholder",
                    "Country of Birth"
                  )}
                />
              )}
            </View>

            <View className="mb-4">
              <View className="flex-row items-center">
                <Text className="text-base text-red-500 mr-1">*</Text>
                <DatePicker
                  value={formData.dateOfBirth}
                  onValueChange={(value) => {
                    shouldAutoSaveDateOfBirth.current = true;
                    handleInputChange("dateOfBirth", value);
                  }}
                  placeholder={getTranslation(
                    "dateOfBirthPlaceholder",
                    "Date of Birth"
                  )}
                  className={`flex-1 ${validationErrors.includes(
                    getTranslation("dateOfBirthPlaceholder", "Date of Birth")
                  ) ||
                    validationErrors.includes(
                      getTranslation("dateOfBirthRequired", "Date of birth is required")
                    )
                    ? "border-red-500"
                    : ""
                    }`}
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-base text-gray-600">
                {getTranslation(
                  "hasImmigrationAttorneyLabel",
                  "Do you currently have an immigration attorney?"
                )}
              </Text>
              <CustomPicker
                selectedValue={formData.hasImmigrationAttorney}
                onValueChange={(value) =>
                  handleInputChange("hasImmigrationAttorney", value)
                }
                items={[
                  { label: "Yes", value: "Yes" },
                  { label: "No", value: "No" },
                  { label: "Unknown", value: "Unknown" },
                ]}
                placeholder={getTranslation(
                  "selectYesNoUnknownPlaceholder",
                  "Select Yes, No, or Unknown"
                )}
              />
            </View>

            <View className="mb-8">
              <EnhancedTextInput
                className="w-full rounded-md border border-gray-300 bg-white p-3 text-black"
                value={formData.immigrationAttorneyNotes}
                onChangeText={(text) =>
                  handleInputChange("immigrationAttorneyNotes", text)
                }
                onBlur={() => autoSaveToStorage(formData)}
                placeholder={getTranslation(
                  "immigrationAttorneyNotesPlaceholder",
                  "Notes about your attorney (optional)"
                )}
                placeholderTextColor="#9ca3af"
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="done"
                doneButtonText={getTranslation("done", "Done")}
              />
            </View>
          </View>

          <View className="mt-8 rounded-xl border border-gray-300 bg-gray-100 p-2">
            <Text className="mb-4 text-center text-lg font-bold text-gray-700">
              {getTranslation("emergencyContact", "Emergency Contact")}
            </Text>

            <View className="mb-4">
              <View className="flex-row items-center">
                <Text className="text-base text-red-500 mr-1">*</Text>
                <EnhancedTextInput
                  className={`flex-1 rounded-md border ${validationErrors.includes(
                    getTranslation(
                      "emergencyContactNamePlaceholder",
                      "Emergency Contact Name"
                    )
                  ) ||
                    validationErrors.includes(
                      getTranslation(
                        "emergencyContactNameInvalid",
                        "Please enter both first name and last name"
                      )
                    )
                    ? "border-red-500"
                    : "border-gray-300"
                    } bg-white p-3 text-black`}
                  value={formData.emergencyContactName}
                  onChangeText={(text) =>
                    handleInputChange("emergencyContactName", text)
                  }
                  onBlur={() => autoSaveToStorage(formData)}
                  placeholder={getTranslation(
                    "emergencyContactNamePlaceholder",
                    "First & Last Name"
                  )}
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                  doneButtonText={getTranslation("done", "Done")}
                />
              </View>
            </View>

            <View className="mb-4">
              <EnhancedTextInput
                className="w-full rounded-md border border-gray-300 bg-white p-3 text-black"
                value={formData.emergencyContactRelationship}
                onChangeText={(text) =>
                  handleInputChange("emergencyContactRelationship", text)
                }
                onBlur={() => autoSaveToStorage(formData)}
                placeholder={getTranslation(
                  "emergencyContactRelationshipPlaceholder",
                  "Relationship"
                )}
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
                doneButtonText={getTranslation("done", "Done")}
              />
            </View>

            <View className="mb-4">
              <View className="flex-row items-center">
                <Text className="text-base text-red-500 mr-1">*</Text>
                <EnhancedTextInput
                  className={`flex-1 rounded-md border ${validationErrors.includes(
                    getTranslation(
                      "emergencyContactEmailPlaceholder",
                      "Email"
                    )
                  ) ||
                    validationErrors.includes(
                      getTranslation(
                        "emergencyContactEmailInvalid",
                        "Please enter a valid email address"
                      )
                    )
                    ? "border-red-500"
                    : "border-gray-300"
                    } bg-white p-3 text-black`}
                  value={formData.emergencyContactEmail}
                  onChangeText={(text) =>
                    handleInputChange("emergencyContactEmail", text)
                  }
                  onBlur={() => autoSaveToStorage(formData)}
                  placeholder={getTranslation(
                    "emergencyContactEmailPlaceholder",
                    "Email"
                  )}
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  doneButtonText={getTranslation("done", "Done")}
                />
              </View>
            </View>

            <View className="mb-4">
              <View className="flex-row items-center">
                <Text className="text-base text-red-500 mr-1">*</Text>
                <EnhancedTextInput
                  className={`flex-1 rounded-md border ${validationErrors.includes(
                    getTranslation(
                      "emergencyContactPhonePlaceholder",
                      "Emergency Contact Phone"
                    )
                  )
                    ? "border-red-500"
                    : "border-gray-300"
                    } bg-white p-3 text-black`}
                  value={formData.emergencyContactPhone}
                  onChangeText={(text) =>
                    handleInputChange("emergencyContactPhone", text)
                  }
                  onBlur={() => autoSaveToStorage(formData)}
                  placeholder={getTranslation(
                    "emergencyContactPhonePlaceholder",
                    "Phone Number"
                  )}
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  doneButtonText={getTranslation("done", "Done")}
                />
              </View>
            </View>


          </View>

          <View className="my-8 flex-row items-start">
            <TouchableOpacity
              onPress={() =>
                handleInputChange("enableLocationSharing", !formData.enableLocationSharing)
              }
              className="mr-3"
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded border ${formData.enableLocationSharing
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300"
                  }`}
              >
                {formData.enableLocationSharing && (
                  <Text className="text-white">✓</Text>
                )}
              </View>
            </TouchableOpacity>
            <View className="flex-1 flex-col">
              <Text className="text-lg text-gray-600 flex-wrap">
                {getTranslation(
                  "enableLocationSharing",
                  "Enable Location Sharing"
                )}
              </Text>
              <Text className="mt-4 text-base text-gray-600 flex-wrap leading-5">
                {getTranslation(
                  "enableLocationSharingNotes",
                  "Note: Your location will only be shared at the time the Alert Button is pressed"
                )}
              </Text>
            </View>
          </View>
          <View className="mb-4">
            <Text className="text-base text-gray-500 italic mb-2">
              <Text className="text-red-500">*</Text>{" "}
              {getTranslation("requiredFields", "Required fields")}
            </Text>
          </View>
        </View>

        {!hideButtons && (
          <View className="my-8">
            {showSkipButton && onSkip && (
              <Button
                text={getTranslation("skip", "Skip")}
                onPress={onSkip}
                style={{
                  backgroundColor: "#edf2fe",
                }}
                textStyle={{ color: "#6776cc" }}
                className="mb-4"
              />
            )}
            <Button
              text={saveButtonText}
              onPress={handleSaveForm}
              style={{ backgroundColor: "#6776cc" }}
            />
          </View>
        )}

        {/* Custom Modal */}
        <Modal visible={showModal} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/50 p-5">
            <View className="w-full max-w-md items-center rounded-xl bg-white p-5">
              <Text className="mb-4 text-center text-2xl font-bold">
                {modalTitle}
              </Text>
              <Text className="mb-2.5 text-center text-base text-gray-600">
                {modalMessage}
              </Text>

              <Button
                text="OK"
                onPress={() => setShowModal(false)}
                style={{ backgroundColor: "#8c8d98", marginTop: 20 }}
              />
            </View>
          </View>
        </Modal>

        {/* Validation Error Modal */}
        <Modal
          visible={showValidationModal}
          transparent={true}
          animationType="fade"
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-5">
            <View className="w-full max-w-md items-center rounded-xl bg-white p-5">
              <Text className="mb-4 text-center text-2xl font-bold">
                {getTranslation(
                  "validationErrorTitle",
                  alertT("validationErrorTitle")
                )}
              </Text>
              <Text className="mb-2.5 text-center text-base text-gray-600">
                {getTranslation(
                  "validationErrorMessage",
                  alertT("validationErrorMessage")
                )}
              </Text>

              {validationErrors.length > 0 && (
                <View className="mb-4 px-4">
                  <Text className="text-base text-gray-600 font-bold mb-2">
                    {getTranslation("missingFields", "Missing fields:")}
                  </Text>
                  {validationErrors.map((error, index) => (
                    <Text key={index} className="text-red-500">
                      • {error}
                    </Text>
                  ))}
                </View>
              )}

              <Button
                text={getTranslation("ok", alertT("ok"))}
                onPress={() => setShowValidationModal(false)}
                style={{ backgroundColor: "#8c8d98", marginTop: 20 }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default LegalSupportForm;
