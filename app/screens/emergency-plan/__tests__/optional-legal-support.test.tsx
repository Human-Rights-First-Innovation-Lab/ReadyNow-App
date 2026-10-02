/**
 * Optional Legal Support Screen Tests
 * 
 * Tests the optional legal support screen including:
 * - Rendering the legal support form
 * - Save and continue functionality
 * - Skip functionality
 * - Translation passing
 * - Navigation
 * - Error handling
 * - Platform-specific rendering (iOS vs Android)
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import OptionalLegalSupportScreen from "../optional-legal-support";
import * as SecureStore from "expo-secure-store";

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
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
jest.mock("../../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        title: "Optional Legal Support",
        additionalLegalHelp: "Additional Legal Help",
        instructions: "Fill in the information below",
        saveAndContinue: "Save & Continue",
        skip: "Skip",
        validationErrorTitle: "Missing Information",
        validationErrorMessage: "Please fill in all required fields",
        ok: "OK",
        missingFields: "Missing fields:",
        requiredFields: "Required fields",
        emergencyContactPhoneInvalid: "Phone number must be 10 digits",
        emergencyContactNameInvalid: "Please enter both first and last name",
        aNumberInvalid: "A-Number must be 9 digits",
        emergencyContactEmailRequired: "Email is required",
        emergencyContactEmailInvalid: "Please enter a valid email address",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock LegalSupportForm component
const mockOnSave = jest.fn();
const mockOnSkip = jest.fn();

jest.mock("../../../components/LegalSupportForm", () => ({
  LegalSupportForm: jest.fn((props) => {
    const React = require("react");
    const { View, Text, TouchableOpacity } = require("react-native");
    
    // Store callbacks for testing
    mockOnSave.mockImplementation(props.onSave);
    mockOnSkip.mockImplementation(props.onSkip);
    
    return React.createElement(
      View,
      { testID: "legal-support-form" },
      React.createElement(Text, null, "Legal Support Form"),
      React.createElement(
        TouchableOpacity,
        {
          testID: "form-save-button",
          onPress: () => props.onSave({
            firstName: "John",
            lastName: "Doe",
            middleName: "",
            aNumber: "",
            countryOfBirth: "Mexico",
            hasImmigrationAttorney: "No",
            immigrationAttorneyNotes: "",
            emergencyContactName: "Jane Doe",
            emergencyContactRelationship: "Spouse",
            emergencyContactEmail: "jane@example.com",
            emergencyContactPhone: "5551234567",
            canContactEmergencyContact: true,
            enableLocationSharing: true,
            canHRFContact: true,
          }),
        },
        React.createElement(Text, null, props.saveButtonText)
      ),
      props.onSkip && React.createElement(
        TouchableOpacity,
        {
          testID: "form-skip-button",
          onPress: props.onSkip,
        },
        React.createElement(Text, null, "Skip")
      )
    );
  }),
}));

// Mock EmergencyPlanBottomNavigation
jest.mock("../../../components/EmergencyPlanBottomNavigation", () => {
  return jest.fn(() => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "bottom-navigation" });
  });
});

describe("OptionalLegalSupportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockClear();
    mockOnSkip.mockClear();
    
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("renders the screen", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("legal-support-form")).toBeTruthy();
      });
    });

    it("renders the legal support form component", async () => {
      const { getByText } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByText("Legal Support Form")).toBeTruthy();
      });
    });

    it("renders bottom navigation", () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      expect(getByTestId("bottom-navigation")).toBeTruthy();
    });

  });

  describe("Form Integration", () => {
    it("passes correct props to LegalSupportForm", async () => {
      const LegalSupportForm = require("../../../components/LegalSupportForm").LegalSupportForm;
      
      render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(LegalSupportForm).toHaveBeenCalled();
      });
      
      const formProps = LegalSupportForm.mock.calls[0][0];
      expect(formProps.onSave).toBeInstanceOf(Function);
      expect(formProps.onSkip).toBeInstanceOf(Function);
      expect(formProps.saveButtonText).toBe("Save & Continue");
      expect(formProps.translations.additionalLegalHelp).toBe("Additional Legal Help");
      expect(formProps.translations.skip).toBe("Skip");
    });

    it("passes all translation keys to form", async () => {
      const LegalSupportForm = require("../../../components/LegalSupportForm").LegalSupportForm;
      
      render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(LegalSupportForm).toHaveBeenCalled();
      });
      
      const translations = LegalSupportForm.mock.calls[0][0].translations;
      
      expect(translations).toHaveProperty("validationErrorTitle");
      expect(translations).toHaveProperty("validationErrorMessage");
      expect(translations).toHaveProperty("missingFields");
      expect(translations).toHaveProperty("requiredFields");
      expect(translations).toHaveProperty("emergencyContactPhoneInvalid");
      expect(translations).toHaveProperty("emergencyContactNameInvalid");
      expect(translations).toHaveProperty("aNumberInvalid");
      expect(translations).toHaveProperty("emergencyContactEmailRequired");
      expect(translations).toHaveProperty("emergencyContactEmailInvalid");
    });
  });

  describe("Save and Continue", () => {
    it("saves legal support data to SecureStore", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "additionalLegalHelp",
          expect.stringContaining("John")
        );
      });
    });

    it("saves complete form data", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        const savedData = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1];
        const parsedData = JSON.parse(savedData);
        
        expect(parsedData).toEqual(
          expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
            emergencyContactName: "Jane Doe",
            emergencyContactEmail: "jane@example.com",
            emergencyContactPhone: "5551234567",
            canContactEmergencyContact: true,
            enableLocationSharing: true,
          })
        );
      });
    });

    it("navigates to personal-message-setup after saving", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/personal-message-setup");
      });
    });

    it("handles save error gracefully", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(
        new Error("Save failed")
      );
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error saving legal support data:",
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it("logs error when save fails", async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(
        new Error("Save failed")
      );
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        // Should log the error
        expect(consoleSpy).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Skip Functionality", () => {
    it("navigates to personal-message-setup when skip is pressed", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-skip-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-skip-button"));
      
      expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/personal-message-setup");
    });

    it("does not save data when skipping", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-skip-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-skip-button"));
      
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("Translation Integration", () => {
    it("provides all necessary translations to the form", async () => {
      const LegalSupportForm = require("../../../components/LegalSupportForm").LegalSupportForm;
      
      render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(LegalSupportForm).toHaveBeenCalled();
      });
      
      const formProps = LegalSupportForm.mock.calls[0][0];
      const translations = formProps.translations;
      
      // Verify all required translation keys are provided
      expect(translations.validationErrorTitle).toBe("Missing Information");
      expect(translations.validationErrorMessage).toBe("Please fill in all required fields");
      expect(translations.ok).toBe("OK");
      expect(translations.skip).toBe("Skip");
    });

    it("includes validation error translations", async () => {
      const LegalSupportForm = require("../../../components/LegalSupportForm").LegalSupportForm;
      
      render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(LegalSupportForm).toHaveBeenCalled();
      });
      
      const translations = LegalSupportForm.mock.calls[0][0].translations;
      
      expect(translations.emergencyContactPhoneInvalid).toBe("Phone number must be 10 digits");
      expect(translations.emergencyContactNameInvalid).toBe("Please enter both first and last name");
      expect(translations.aNumberInvalid).toBe("A-Number must be 9 digits");
      expect(translations.emergencyContactEmailInvalid).toBe("Please enter a valid email address");
    });
  });

  describe("Platform-Specific Behavior", () => {
    it("renders correctly on different platforms", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      // Form should render regardless of platform
      await waitFor(() => {
        expect(getByTestId("legal-support-form")).toBeTruthy();
      });
      expect(getByTestId("bottom-navigation")).toBeTruthy();
    });
  });

  describe("Data Flow", () => {
    it("saves form data as JSON string", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        const savedValue = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1];
        expect(() => JSON.parse(savedValue)).not.toThrow();
      });
    });

    it("saves data to correct SecureStore key", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "additionalLegalHelp",
          expect.any(String)
        );
      });
    });
  });

  describe("Form Callbacks", () => {
    it("saves data when form save is triggered", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-save-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-save-button"));
      
      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalled();
      });
    });

    it("navigates when form skip is triggered", async () => {
      const { getByTestId } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByTestId("form-skip-button")).toBeTruthy();
      });
      
      fireEvent.press(getByTestId("form-skip-button"));
      
      expect(mockPush).toHaveBeenCalledWith("/screens/emergency-plan/personal-message-setup");
    });
  });

  describe("Button Text", () => {
    it("passes custom save button text to form", async () => {
      const LegalSupportForm = require("../../../components/LegalSupportForm").LegalSupportForm;
      
      render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(LegalSupportForm).toHaveBeenCalled();
      });
      
      const formProps = LegalSupportForm.mock.calls[0][0];
      expect(formProps.saveButtonText).toBe("Save & Continue");
    });

    it("displays save button text in form", async () => {
      const { getByText } = render(<OptionalLegalSupportScreen />);
      
      await waitFor(() => {
        expect(getByText("Save & Continue")).toBeTruthy();
      });
    });
  });
});

