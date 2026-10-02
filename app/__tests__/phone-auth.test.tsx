import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import PhoneAuthScreen from "../phone-auth";
import { requestSmsCode } from "../utils/auth-service";

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({
    returnTo: "",
  }),
  Stack: {
    Screen: ({ children, options }: any) => children,
  },
}));

// Mock auth service
jest.mock("../utils/auth-service", () => ({
  requestSmsCode: jest.fn(),
}));

// Mock auth config
jest.mock("../utils/auth-config", () => ({
  formatPhoneNumberForAuth0: (phone: string) => `+1${phone}`,
}));

// Mock modal context
const mockShowError = jest.fn();
jest.mock("../context/ModalContext", () => ({
  useModal: () => ({
    showError: mockShowError,
  }),
}));

// Mock EnhancedTextInput
jest.mock("../components/EnhancedTextInput", () => ({
  EnhancedTextInput: require("react-native").TextInput,
}));

// Mock Button component
jest.mock("../components/Button", () => {
  const React = require("react");
  const { TouchableOpacity, Text } = require("react-native");
  
  return function MockButton({ text, onPress, disabled, style }: any) {
    return (
      <TouchableOpacity
        testID="button"
        onPress={onPress}
        disabled={disabled}
        style={style}
        accessibilityState={{ disabled }}
      >
        <Text>{text}</Text>
      </TouchableOpacity>
    );
  };
});

describe("PhoneAuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the phone auth screen correctly", () => {
      const { getByText, getByPlaceholderText } = render(<PhoneAuthScreen />);
      
      expect(getByText("Verify Your Phone")).toBeTruthy();
      expect(getByText("We'll send you a verification code to confirm your identity")).toBeTruthy();
      expect(getByText("Phone Number")).toBeTruthy();
      expect(getByPlaceholderText("(555)-123-4567")).toBeTruthy();
    });

    it("displays continue button", () => {
      const { getByText } = render(<PhoneAuthScreen />);
      
      expect(getByText("Continue")).toBeTruthy();
    });
  });

  describe("Phone Number Input", () => {
    it("allows entering phone number", () => {
      const { getByPlaceholderText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      expect(input.props.value).toBe("(555)-123-4567");
    });

    it("formats phone number as user types", () => {
      const { getByPlaceholderText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      
      // Type first 3 digits
      fireEvent.changeText(input, "555");
      expect(input.props.value).toBe("(555");
      
      // Type 6 digits
      fireEvent.changeText(input, "555123");
      expect(input.props.value).toBe("(555)-123");
      
      // Type all 10 digits
      fireEvent.changeText(input, "5551234567");
      expect(input.props.value).toBe("(555)-123-4567");
    });

    it("removes non-digit characters", () => {
      const { getByPlaceholderText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "555-123-4567");
      
      // Should only keep digits
      expect(input.props.value).toBe("(555)-123-4567");
    });

    it("limits input to 10 digits", () => {
      const { getByPlaceholderText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "55512345678901234");
      
      // Should truncate to 10 digits
      expect(input.props.value).toBe("(555)-123-4567");
    });

    it("shows validation error for incomplete phone number", () => {
      const { getByPlaceholderText, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "555123");
      
      expect(getByText("Please enter a 10-digit phone number")).toBeTruthy();
    });

    it("does not show validation error for complete phone number", () => {
      const { getByPlaceholderText, queryByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      expect(queryByText("Please enter a 10-digit phone number")).toBeNull();
    });
  });

  describe("Continue Button", () => {
    it("is disabled when phone number is empty", () => {
      const { getByTestId } = render(<PhoneAuthScreen />);
      
      const button = getByTestId("button");
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it("is disabled when phone number is incomplete", () => {
      const { getByPlaceholderText, getByTestId } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "555123");
      
      const button = getByTestId("button");
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it("is enabled when phone number is complete", () => {
      const { getByPlaceholderText, getByTestId } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      const button = getByTestId("button");
      expect(button.props.accessibilityState.disabled).toBe(false);
    });
  });

  describe("SMS Code Request", () => {
    it("sends SMS code when continue is pressed with valid phone number", async () => {
      (requestSmsCode as jest.Mock).mockResolvedValue(true);
      
      const { getByPlaceholderText, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(requestSmsCode).toHaveBeenCalledWith("5551234567");
      });
    });

    it("navigates to OTP screen on successful SMS send", async () => {
      (requestSmsCode as jest.Mock).mockResolvedValue(true);
      
      const { getByPlaceholderText, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith({
          pathname: "otp-verification",
          params: {
            phoneNumber: "+15551234567",
            returnTo: "",
          },
        });
      });
    });

    it("shows error message when SMS send fails", async () => {
      (requestSmsCode as jest.Mock).mockRejectedValue(new Error("Network error"));
      
      const { getByPlaceholderText, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          "Failed to send verification code. Please try again."
        );
      });
    });

    it("shows loading state while sending SMS", async () => {
      (requestSmsCode as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const { getByPlaceholderText, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      // Should show loading state
      expect(getByText("Sending...")).toBeTruthy();
      
      await waitFor(() => {
        expect(getByText("Continue")).toBeTruthy();
      });
    });

    it("disables button while sending SMS", async () => {
      (requestSmsCode as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const { getByPlaceholderText, getByTestId, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      const button = getByTestId("button");
      expect(button.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe("Apple Reviewer Bypass", () => {
    it("bypasses SMS for reviewer phone number", async () => {
      const { getByPlaceholderText, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5555551234");
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(requestSmsCode).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith({
          pathname: "otp-verification",
          params: {
            phoneNumber: "+15555551234",
            returnTo: "",
            reviewerMode: "true",
          },
        });
      });
    });
  });

  describe("Return To Parameter", () => {
    it("passes returnTo parameter to OTP screen", async () => {
      (requestSmsCode as jest.Mock).mockResolvedValue(true);
      
      jest.spyOn(require("expo-router"), "useLocalSearchParams").mockReturnValue({
        returnTo: "plan",
      });
      
      const { getByPlaceholderText, getByText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "5551234567");
      
      const continueButton = getByText("Continue");
      fireEvent.press(continueButton);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith({
          pathname: "otp-verification",
          params: {
            phoneNumber: "+15551234567",
            returnTo: "plan",
          },
        });
      });
    });
  });

  describe("Validation", () => {
    it("button is disabled with empty phone number", () => {
      const { getByTestId } = render(<PhoneAuthScreen />);
      
      const button = getByTestId("button");
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it("button is disabled with incomplete phone number", () => {
      const { getByPlaceholderText, getByTestId } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      fireEvent.changeText(input, "555123");
      
      const button = getByTestId("button");
      expect(button.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe("Accessibility", () => {
    it("has accessible phone input field", () => {
      const { getByPlaceholderText } = render(<PhoneAuthScreen />);
      
      const input = getByPlaceholderText("(555)-123-4567");
      expect(input).toBeTruthy();
      expect(input.props.keyboardType).toBe("phone-pad");
    });

    it("has accessible continue button", () => {
      const { getByTestId } = render(<PhoneAuthScreen />);
      
      const button = getByTestId("button");
      expect(button).toBeTruthy();
    });

    it("button has proper disabled state for screen readers", () => {
      const { getByTestId } = render(<PhoneAuthScreen />);
      
      const button = getByTestId("button");
      expect(button.props.accessibilityState).toHaveProperty("disabled");
    });
  });
});

