import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import AlertButton from "../AlertButton";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { sendIntakeToNilra } from "../../services/nilra-api";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock dependencies
jest.mock("expo-secure-store");
jest.mock("expo-location");
jest.mock("expo-router");
jest.mock("../../services/nilra-api");
jest.mock("../../services/alert-api");
jest.mock("../../utils/storage-utils");
jest.mock("../../utils/encryption-utils");
jest.mock("../../utils/emergency-plan-utils");
jest.mock("../../utils/app-settings");
jest.mock("../../translations");
jest.mock("../../context/ModalContext");
jest.mock("../../utils/auth-service");
jest.mock("../../utils/auth-config", () => ({
  AUTH0_CONFIG: {
    domain: "test.auth0.com",
    clientId: "test-client-id",
  },
  formatPhoneNumberForAuth0: (phone: string) => `+1${phone}`,
}));

// Mock React Navigation
jest.mock("@react-navigation/core", () => ({
  ...jest.requireActual("@react-navigation/core"),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("AlertButton", () => {
  const mockOnPress = jest.fn();
  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  };

  const mockModal = {
    showLoadingModal: jest.fn(),
    hideLoadingModal: jest.fn(),
    updateLoadingMessage: jest.fn(),
    showAlertSentModal: jest.fn(),
    hideAlertSentModal: jest.fn(),
    showAccidentalModal: jest.fn(),
    hideAccidentalModal: jest.fn(),
    showRateLimitModal: jest.fn(),
    hideRateLimitModal: jest.fn(),
    showNoticeModal: jest.fn(),
    hideNoticeModal: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default: handoff succeeds. Individual tests override.
    const alertApi = require("../../services/alert-api");
    alertApi.prepareAlert.mockResolvedValue({
      alertId: "8f14e45f-ceea-467a-9575-3b2d4c2f9a11",
      key: "k",
      ciphertext: "RN1.x",
      planHash: "h",
      staged: false,
    });
    alertApi.stageAlert.mockResolvedValue(true);
    alertApi.fireAlert.mockResolvedValue({ ok: true, created: 1, deduped: 0 });
    alertApi.cancelAlert.mockResolvedValue(undefined);

    // Setup router mock
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Setup modal context mock
    const modalContextModule = require("../../context/ModalContext");
    modalContextModule.useModal = jest.fn().mockReturnValue(mockModal);

    // Setup app settings mock
    const appSettingsModule = require("../../utils/app-settings");
    appSettingsModule.useAppSettings = jest.fn().mockReturnValue({
      settings: { language: "en" },
    });

    // Setup translations mock
    const translationsModule = require("../../translations");
    translationsModule.usePageTranslation = jest.fn().mockReturnValue({
      t: (key: string) => key,
    });

    // Setup SecureStore mocks
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    // Setup Location mocks
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
      },
      timestamp: Date.now(),
    });

    // Setup fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
    });

    // Setup NILRA API mock
    (sendIntakeToNilra as jest.Mock).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe("Rendering", () => {
    it("renders correctly", () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      expect(getByText("sendAlert")).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { root } = render(<AlertButton onPress={mockOnPress} size={150} />);
      expect(root).toBeTruthy();
    });

    it("renders in demo mode with green color", () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} isDemoMode={true} />);
      expect(getByText("sendAlert")).toBeTruthy();
    });

    it("renders disabled state", () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} disabled={true} />);
      expect(getByText("sendAlert")).toBeTruthy();
    });
  });

  describe("Press Interactions", () => {
    it("starts countdown on long press", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      // Simulate press in
      fireEvent(button!, "pressIn");

      // Fast-forward past the 1.5 second threshold
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Should show countdown modal
      await waitFor(() => {
        expect(getByText("sendingAlert")).toBeTruthy();
      });
    });

    it("cancels countdown on press out before threshold", () => {
      const { getByText, queryByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      // Simulate press in
      fireEvent(button!, "pressIn");

      // Release before threshold
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      fireEvent(button!, "pressOut");

      // Should not show countdown modal
      expect(queryByText("sendingAlert")).toBeNull();
    });

    it("does not respond when disabled", () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} disabled={true} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");

      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Should not trigger countdown
      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe("Countdown Modal", () => {
    it("shows countdown from 3 to 0", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(getByText("3")).toBeTruthy();
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(getByText("2")).toBeTruthy();
      });
    });

    it("cancels alert when cancel button is pressed", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(getByText("cancelAlert")).toBeTruthy();
      });

      const cancelButton = getByText("cancelAlert");
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(getByText("alertCancelled")).toBeTruthy();
      });
    });

    it("shows demo mode text in countdown", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} isDemoMode={true} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(getByText("emergencyMessagesSentDemo")).toBeTruthy();
      });
    });
  });

  describe("Alert Sending - Demo Mode", () => {
    it("calls onPress immediately in demo mode", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} isDemoMode={true} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Wait for countdown
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockOnPress).toHaveBeenCalled();
      });
    });

    it("does not send actual messages in demo mode", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} isDemoMode={true} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockOnPress).toHaveBeenCalled();
      });

      // Should not call fetch
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Alert Sending - Real Mode", () => {
    it("shows loading modal when sending alert", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockModal.showLoadingModal).toHaveBeenCalledWith("Sending alert...");
      });
    });

    it("retrieves location when location sharing is enabled", async () => {
      const legalSupportData = {
        enableLocationSharing: true,
        firstName: "John",
        lastName: "Doe",
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "additionalLegalHelp") {
          return Promise.resolve(JSON.stringify(legalSupportData));
        }
        return Promise.resolve(null);
      });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it("sends data to NILRA API when legal support data exists", async () => {
      const legalSupportData = {
        enableLocationSharing: false,
        firstName: "John",
        lastName: "Doe",
        aNumber: "123456789",
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "additionalLegalHelp") {
          return Promise.resolve(JSON.stringify(legalSupportData));
        }
        return Promise.resolve(null);
      });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(sendIntakeToNilra).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
          }),
          undefined,
          undefined,
          "en"
        );
      });
    });

    it("handles NILRA API errors gracefully", async () => {
      const legalSupportData = {
        enableLocationSharing: false,
        firstName: "John",
        lastName: "Doe",
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "additionalLegalHelp") {
          return Promise.resolve(JSON.stringify(legalSupportData));
        }
        return Promise.resolve(null);
      });

      (sendIntakeToNilra as jest.Mock).mockResolvedValue({
        success: false,
        error: "API Error",
      });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Wait for async operations to complete (handleAlertSent function)
      await act(async () => {
        // Flush all pending promises
        await Promise.resolve();
        await Promise.resolve();
      });

      // Advance timers to execute setTimeout(0) in finally block
      await act(async () => {
        jest.runAllTimers();
        // Flush promises again after timers run
        await Promise.resolve();
      });

      // Should continue despite error
      await waitFor(() => {
        expect(mockModal.hideLoadingModal).toHaveBeenCalled();
      });
    });
  });

  describe("Handoff and wiping", () => {
    const planWithOneContact = () => {
      const storageUtils = require("../../utils/storage-utils");
      jest.spyOn(storageUtils, "loadEmergencyPlanData").mockResolvedValue({
        messages: [
          {
            id: "msg-1",
            topic: "Test",
            message: "Test message",
            contacts: [{ id: "c1", name: "John", phoneNumber: "+15551234567" }],
          },
        ],
      });
      return storageUtils;
    };

    const pressAndHold = (getByText: (t: string) => any) => {
      const button = getByText("sendAlert").parent?.parent;
      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      act(() => {
        jest.advanceTimersByTime(3000);
      });
    };

    it("wipes local data and reports failure when the alert cannot be handed off", async () => {
      // The behaviour this replaces: a failed send showed "Alert Sent" and
      // wiped anyway, so the user believed their contacts had been notified.
      const storageUtils = planWithOneContact();
      const resetSpy = jest
        .spyOn(storageUtils, "resetEmergencyPlanData")
        .mockResolvedValue(undefined);

      const alertApi = require("../../services/alert-api");
      alertApi.stageAlert.mockResolvedValue(false);
      alertApi.fireAlert.mockResolvedValue({ ok: false, reason: "unreachable" });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      pressAndHold(getByText);

      await waitFor(
        () => {
          expect(mockModal.showNoticeModal).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Data still goes, per the threat model: the device is assumed to be
      // about to be seized, so a failed send earns no reprieve.
      expect(resetSpy).toHaveBeenCalled();
      // And the success modal must not appear.
      expect(mockModal.showAlertSentModal).not.toHaveBeenCalled();
    });

    it("wipes local data and reports success when the alert is handed off", async () => {
      const storageUtils = planWithOneContact();
      const resetSpy = jest
        .spyOn(storageUtils, "resetEmergencyPlanData")
        .mockResolvedValue(undefined);

      const alertApi = require("../../services/alert-api");
      alertApi.fireAlert.mockResolvedValue({ ok: true, created: 1, deduped: 0 });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      pressAndHold(getByText);

      await waitFor(
        () => {
          expect(mockModal.showAlertSentModal).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      expect(resetSpy).toHaveBeenCalled();
      expect(mockModal.showNoticeModal).not.toHaveBeenCalled();
    });

    it("wipes without waiting for the user to dismiss the modal", async () => {
      // A phone seized while the modal is on screen must already be clear.
      const storageUtils = planWithOneContact();
      const resetSpy = jest
        .spyOn(storageUtils, "resetEmergencyPlanData")
        .mockResolvedValue(undefined);

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      pressAndHold(getByText);

      await waitFor(() => expect(resetSpy).toHaveBeenCalled(), { timeout: 3000 });

      // No close handler has been invoked at this point.
      expect(mockModal.hideAlertSentModal).not.toHaveBeenCalled();
    });

    it("does not fire or wipe when the countdown is cancelled", async () => {
      const storageUtils = planWithOneContact();
      const resetSpy = jest
        .spyOn(storageUtils, "resetEmergencyPlanData")
        .mockResolvedValue(undefined);

      const alertApi = require("../../services/alert-api");

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Cancel before the countdown completes.
      await waitFor(() => expect(getByText("cancelAlert")).toBeTruthy());
      fireEvent.press(getByText("cancelAlert"));

      await waitFor(() => expect(alertApi.cancelAlert).toHaveBeenCalled(), {
        timeout: 3000,
      });

      expect(alertApi.fireAlert).not.toHaveBeenCalled();
      expect(resetSpy).not.toHaveBeenCalled();
    });
  });

  describe("Location Handling", () => {
    it("requests location permission when not granted", async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.UNDETERMINED,
      });

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
      });

      const legalSupportData = {
        enableLocationSharing: true,
        firstName: "John",
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "additionalLegalHelp") {
          return Promise.resolve(JSON.stringify(legalSupportData));
        }
        return Promise.resolve(null);
      });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it("handles gracefully when location retrieval hangs indefinitely", async () => {
      // Mock location promise that never resolves (simulating hang scenario)
      (Location.getCurrentPositionAsync as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves - component should not get stuck
      );

      const legalSupportData = {
        enableLocationSharing: true,
        firstName: "John",
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "additionalLegalHelp") {
          return Promise.resolve(JSON.stringify(legalSupportData));
        }
        return Promise.resolve(null);
      });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Component should start the alert process
      await waitFor(() => {
        expect(mockModal.showLoadingModal).toHaveBeenCalled();
      });
      
      // Verify component doesn't crash despite location never resolving
      expect(mockModal.showLoadingModal).toHaveBeenCalledWith("Sending alert...");
    });

    it("saves location data to SecureStore", async () => {
      const legalSupportData = {
        enableLocationSharing: true,
        firstName: "John",
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "additionalLegalHelp") {
          return Promise.resolve(JSON.stringify(legalSupportData));
        }
        return Promise.resolve(null);
      });

      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          "additionalLegalHelp",
          expect.stringContaining("location")
        );
      });
    });
  });

  describe("Cancelled Modal", () => {
    it("shows cancelled modal after cancelling alert", async () => {
      const { getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(getByText("cancelAlert")).toBeTruthy();
      });

      const cancelButton = getByText("cancelAlert");
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(getByText("alertCancelled")).toBeTruthy();
        expect(getByText("alertCancelledMessage")).toBeTruthy();
      });
    });

    it("closes cancelled modal when close button is pressed", async () => {
      const { getByText, queryByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(getByText("cancelAlert")).toBeTruthy();
      });

      fireEvent.press(getByText("cancelAlert"));

      await waitFor(() => {
        expect(getByText("close")).toBeTruthy();
      });

      fireEvent.press(getByText("close"));

      await waitFor(() => {
        expect(queryByText("alertCancelled")).toBeNull();
      });
    });
  });

  describe("Cleanup", () => {
    it("cleans up timers on unmount", () => {
      const { unmount, getByText } = render(<AlertButton onPress={mockOnPress} />);
      const button = getByText("sendAlert").parent?.parent;

      fireEvent(button!, "pressIn");

      unmount();

      // Should not crash
      act(() => {
        jest.advanceTimersByTime(2000);
      });
    });
  });
});

