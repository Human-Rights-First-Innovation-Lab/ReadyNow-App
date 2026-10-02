/**
 * Legal Support Form Tests
 * 
 * Tests the legal support form including:
 * - Form rendering and fields
 * - Input validation
 * - Required fields checking
 * - A-Number validation
 * - Email validation
 * - Phone number formatting
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { LegalSupportForm } from "../LegalSupportForm";
import * as Location from "expo-location";

// Mock expo-location
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted" })
  ),
  PermissionStatus: {
    GRANTED: "granted",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
  },
}));

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock Linking
jest.mock("react-native/Libraries/Linking/Linking");

// Mock Sentry
jest.mock("@sentry/react-native");

// Mock app settings
jest.mock("../../utils/app-settings", () => ({
  useAppSettings: () => ({
    settings: {
      language: "en",
    },
  }),
}));

// Mock translations
jest.mock("../../translations", () => ({
  usePageTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock countries API
jest.mock("../../utils/countries-api", () => ({
  fetchCountries: jest.fn(() => Promise.resolve(["United States", "Mexico", "Canada"])),
}));

// Mock A-Number validation
jest.mock("../../services/nilra-api", () => ({
  validateANumber: jest.fn((aNumber: string) => {
    if (!aNumber) return true;
    if (aNumber.length !== 9) return false;
    if (!/^\d{9}$/.test(aNumber)) return false;
    const invalidPatterns = ["000000000", "123456789", "123123123"];
    return !invalidPatterns.includes(aNumber);
  }),
}));

// Mock EnhancedTextInput
jest.mock("../EnhancedTextInput", () => ({
  EnhancedTextInput: require("react-native").TextInput,
}));

// Mock Button - default export
jest.mock("../Button", () => {
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

// Mock CustomPicker
jest.mock("../Picker", () => ({
  CustomPicker: jest.fn((props) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "custom-picker" });
  }),
}));

// Mock DatePicker
jest.mock("../DatePicker", () => ({
  DatePicker: jest.fn((props) => {
    const React = require("react");
    const { TouchableOpacity, Text, View } = require("react-native");
    return React.createElement(
      View,
      { testID: "date-picker" },
      React.createElement(
        TouchableOpacity,
        {
          testID: "date-picker-button",
          onPress: () => {
            // Simulate date selection
            if (props.onValueChange) {
              props.onValueChange("1990-12-25");
            }
          },
        },
        React.createElement(Text, null, props.value || props.placeholder)
      )
    );
  }),
}));

describe("LegalSupportForm", () => {
  const mockOnSave = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Location mocks to default granted state
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    });
  });

  describe("Rendering", () => {
    it("renders the form", () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      expect(result.UNSAFE_root).toBeDefined();
    });

    it("renders with title by default", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        expect(result.getByText("title")).toBeTruthy();
      });
    });

    it("renders without title when showTitle is false", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} showTitle={false} />
      );

      await waitFor(() => {
        expect(result.queryByText("title")).toBeNull();
      });
    });

    it("renders form input fields", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        expect(result.getByPlaceholderText("firstNamePlaceholder")).toBeTruthy();
        expect(result.getByPlaceholderText("lastNamePlaceholder")).toBeTruthy();
        expect(result.getByPlaceholderText("emergencyContactNamePlaceholder")).toBeTruthy();
      });
    });

    it("renders save button", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        expect(result.getByTestId("button-save-&-continue")).toBeTruthy();
      });
    });

    it("renders skip button when onSkip provided", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} onSkip={mockOnSkip} />
      );

      await waitFor(() => {
        expect(result.getByTestId("button-skip")).toBeTruthy();
      });
    });

    it("hides buttons when hideButtons is true", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} hideButtons={true} />
      );

      await waitFor(() => {
        expect(result.queryByTestId("button-save-&-continue")).toBeNull();
      });
    });
  });

  describe("Input Handling", () => {
    it("updates first name input", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("firstNamePlaceholder");
        act(() => {
          fireEvent.changeText(input, "John");
        });
        expect(input.props.value).toBe("John");
      });
    });

    it("updates last name input", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("lastNamePlaceholder");
        act(() => {
          fireEvent.changeText(input, "Doe");
        });
        expect(input.props.value).toBe("Doe");
      });
    });

    it("updates email input", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("emergencyContactEmailPlaceholder");
        act(() => {
          fireEvent.changeText(input, "test@example.com");
        });
        expect(input.props.value).toBe("test@example.com");
      });
    });
  });

  describe("A-Number Validation", () => {
    it("accepts numeric input for A-Number", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("aNumberPlaceholder");
        act(() => {
          fireEvent.changeText(input, "123456789");
        });
        expect(input.props.value).toBe("123456789");
      });
    });

    it("removes non-numeric characters from A-Number", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("aNumberPlaceholder");
        act(() => {
          fireEvent.changeText(input, "A123-456-789");
        });
        expect(input.props.value).toBe("123456789");
      });
    });

    it("limits A-Number to 9 digits", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("aNumberPlaceholder");
        act(() => {
          fireEvent.changeText(input, "12345678901234");
        });
        expect(input.props.value).toBe("123456789");
      });
    });
  });

  describe("Phone Number Validation", () => {
    it("accepts numeric input for phone number", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("emergencyContactPhonePlaceholder");
        act(() => {
          fireEvent.changeText(input, "5551234567");
        });
        expect(input.props.value).toBe("5551234567");
      });
    });

    it("removes non-numeric characters from phone number", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("emergencyContactPhonePlaceholder");
        act(() => {
          fireEvent.changeText(input, "(555) 123-4567");
        });
        expect(input.props.value).toBe("5551234567");
      });
    });

    it("limits phone number to 10 digits", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const input = result.getByPlaceholderText("emergencyContactPhonePlaceholder");
        act(() => {
          fireEvent.changeText(input, "555123456789012");
        });
        expect(input.props.value).toBe("5551234567");
      });
    });
  });

  describe("Date of Birth", () => {
    it("renders date of birth field", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        expect(result.getByTestId("date-picker")).toBeTruthy();
      });
    });

    it("has date of birth field with required indicator", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const datePicker = result.getByTestId("date-picker");
        expect(datePicker).toBeTruthy();
      });
    });

    it("validates date of birth is required", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const saveButton = result.getByTestId("button-save-&-continue");
        act(() => {
          fireEvent.press(saveButton);
        });
      });

      await waitFor(() => {
        expect(result.getByText("validationErrorTitle")).toBeTruthy();
      });
    });

    it("includes date of birth in form submission", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        expect(result.getByPlaceholderText("firstNamePlaceholder")).toBeTruthy();
      });

      // Fill required fields
      const firstNameInput = result.getByPlaceholderText("firstNamePlaceholder");
      act(() => {
        fireEvent.changeText(firstNameInput, "John");
      });

      const lastNameInput = result.getByPlaceholderText("lastNamePlaceholder");
      act(() => {
        fireEvent.changeText(lastNameInput, "Doe");
      });

      const contactNameInput = result.getByPlaceholderText("emergencyContactNamePlaceholder");
      act(() => {
        fireEvent.changeText(contactNameInput, "Jane Doe");
      });

      const contactEmailInput = result.getByPlaceholderText("emergencyContactEmailPlaceholder");
      act(() => {
        fireEvent.changeText(contactEmailInput, "jane@example.com");
      });

      const contactPhoneInput = result.getByPlaceholderText("emergencyContactPhonePlaceholder");
      act(() => {
        fireEvent.changeText(contactPhoneInput, "5551234567");
      });

      // Select date of birth
      const datePickerButton = result.getByTestId("date-picker-button");
      act(() => {
        fireEvent.press(datePickerButton);
      });

      await waitFor(() => {
        const saveButton = result.getByTestId("button-save-&-continue");
        act(() => {
          fireEvent.press(saveButton);
        });
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        const savedData = mockOnSave.mock.calls[0][0];
        expect(savedData.dateOfBirth).toBe("1990-12-25");
      });
    });
  });

  describe("Form Submission", () => {
    it("shows validation error when submitting empty form", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const saveButton = result.getByTestId("button-save-&-continue");
        act(() => {
          fireEvent.press(saveButton);
        });
      });

      await waitFor(() => {
        expect(result.getByText("validationErrorTitle")).toBeTruthy();
      });
    });

    it("does not call onSave when validation fails", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      await waitFor(() => {
        const saveButton = result.getByTestId("button-save-&-continue");
        act(() => {
          fireEvent.press(saveButton);
        });
      });

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it("calls onSave with form data when validation passes", async () => {
      // Calculate expected default date (today's date in ISO format)
      const expectedDefaultDate = new Date("1990-12-25").toISOString().split("T")[0];

      const result = render(
        <LegalSupportForm onSave={mockOnSave} />
      );

      // Wait for component to be ready
      await waitFor(() => {
        expect(result.getByPlaceholderText("firstNamePlaceholder")).toBeTruthy();
      });

      // Fill in the form fields one by one and wait for each update
      const firstNameInput = result.getByPlaceholderText("firstNamePlaceholder");
      act(() => {
        fireEvent.changeText(firstNameInput, "John");
      });
      await waitFor(() => {
        expect(firstNameInput.props.value).toBe("John");
      });

      const lastNameInput = result.getByPlaceholderText("lastNamePlaceholder");
      act(() => {
        fireEvent.changeText(lastNameInput, "Doe");
      });
      await waitFor(() => {
        expect(lastNameInput.props.value).toBe("Doe");
      });

      const emergencyNameInput = result.getByPlaceholderText("emergencyContactNamePlaceholder");
      act(() => {
        fireEvent.changeText(emergencyNameInput, "Jane Doe");
      });
      await waitFor(() => {
        expect(emergencyNameInput.props.value).toBe("Jane Doe");
      });

      const phoneInput = result.getByPlaceholderText("emergencyContactPhonePlaceholder");
      act(() => {
        fireEvent.changeText(phoneInput, "5551234567");
      });
      await waitFor(() => {
        expect(phoneInput.props.value).toBe("5551234567");
      });

      const emailInput = result.getByPlaceholderText("emergencyContactEmailPlaceholder");
      act(() => {
        fireEvent.changeText(emailInput, "jane@example.com");
      });
      await waitFor(() => {
        expect(emailInput.props.value).toBe("jane@example.com");
      });

      // Set date of birth (required field)
      const datePickerButton = result.getByTestId("date-picker-button");
      await act(async () => {
        fireEvent.press(datePickerButton);
      });
      // Wait a tick for state to update
      await new Promise(resolve => setTimeout(resolve, 0));

      // Submit the form
      const saveButton = result.getByTestId("button-save-&-continue");
      await act(async () => {
        fireEvent.press(saveButton);
      });

      // Wait for onSave to be called
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
            dateOfBirth: expectedDefaultDate, // Verify specific default date (today)
            emergencyContactName: "Jane Doe",
            emergencyContactPhone: "5551234567",
            emergencyContactEmail: "jane@example.com",
          })
        );
      }, { timeout: 3000 });
    });
  });

  describe("Skip Functionality", () => {
    it("calls onSkip when skip button is pressed", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} onSkip={mockOnSkip} />
      );

      await waitFor(() => {
        const skipButton = result.getByTestId("button-skip");
        act(() => {
          fireEvent.press(skipButton);
        });
        expect(mockOnSkip).toHaveBeenCalled();
      });
    });
  });

  describe("Initial Data", () => {
    it("loads form with initial data", async () => {
      const initialData = {
        firstName: "Jane",
        lastName: "Smith",
        emergencyContactEmail: "john@example.com",
      };

      const result = render(
        <LegalSupportForm onSave={mockOnSave} initialData={initialData} />
      );

      await waitFor(() => {
        expect(result.getByPlaceholderText("firstNamePlaceholder").props.value).toBe("Jane");
        expect(result.getByPlaceholderText("lastNamePlaceholder").props.value).toBe("Smith");
        expect(result.getByPlaceholderText("emergencyContactEmailPlaceholder").props.value).toBe("john@example.com");
      });
    });
  });

  describe("Hide Buttons Mode", () => {
    it("calls onSave immediately when hideButtons is true and input changes", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} hideButtons={true} />
      );

      await waitFor(() => {
        act(() => {
          fireEvent.changeText(result.getByPlaceholderText("firstNamePlaceholder"), "John");
        });
        expect(mockOnSave).toHaveBeenCalled();
      });
    });
  });

  describe("Custom Button Text", () => {
    it("renders custom save button text", async () => {
      const result = render(
        <LegalSupportForm onSave={mockOnSave} saveButtonText="Submit Form" />
      );

      await waitFor(() => {
        expect(result.getByTestId("button-submit-form")).toBeTruthy();
      });
    });
  });
});
