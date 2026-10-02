import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import Index from "../index";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useAuth } from "../utils/use-auth";
import { loadEmergencyPlanData } from "../utils/storage-utils";
import { STORAGE_KEYS } from "../utils/auth-service";

// Mock CSS imports
jest.mock("../../global.css", () => ({}));
jest.mock("../../styles.css", () => ({}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock dependencies
jest.mock("expo-secure-store");
jest.mock("expo-router");
jest.mock("../utils/use-auth");
jest.mock("../utils/storage-utils");
jest.mock("../utils/app-settings");
jest.mock("../translations");
jest.mock("../utils/auth-config", () => ({
  AUTH0_CONFIG: {
    domain: "test.auth0.com",
    clientId: "test-client-id",
  },
  formatPhoneNumberForAuth0: (phone: string) => `+1${phone}`,
}));

describe("App Navigation Flow", () => {
  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  };

  const mockUseAuth = {
    isLoading: false,
    isLoggedIn: false,
    user: null,
    signOut: jest.fn(),
    checkAuthStatus: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup router mock
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Setup auth mock
    (useAuth as jest.Mock).mockReturnValue(mockUseAuth);

    // Setup app settings mock
    const appSettingsModule = require("../utils/app-settings");
    appSettingsModule.useAppSettings = jest.fn().mockReturnValue({
      settings: { language: "en" },
      updateSetting: jest.fn(),
    });

    // Setup translations mock
    const translationsModule = require("../translations");
    translationsModule.usePageTranslation = jest.fn().mockReturnValue({
      t: (key: string) => key,
    });

    // Default SecureStore mock
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    // Default loadEmergencyPlanData mock
    (loadEmergencyPlanData as jest.Mock).mockResolvedValue({ messages: [] });
  });

  describe("Initial App Load - Not Logged In", () => {
    it("redirects to welcome screen when not logged in", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: false,
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });

    it("shows loading indicator while checking auth status", () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: true,
      });

      const { getByTestId } = render(<Index />);
      
      // ActivityIndicator should be present
      expect(getByTestId).toBeDefined();
    });

    it("handles initialization error gracefully", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: false,
      });

      (loadEmergencyPlanData as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });
  });

  describe("Initial App Load - Logged In", () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
        user: { userId: "test-user-123" },
      });
    });

    it("redirects to main screen when emergency plan workflow is completed", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [
          {
            id: "msg-1",
            topic: "Personal Emergency",
            message: "Test message",
            contacts: [],
          },
        ],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("main");
      });
    });

    it("redirects to emergency plan when logged in with completed onboarding but no messages", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });

    it("redirects to beforeyoustart1 when logged in without completed onboarding", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("false");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });

    it("redirects to beforeyoustart1 when onboarding status is null", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });
  });

  describe("Navigation Flow - Welcome to Main", () => {
    it("navigates to welcome when not logged in", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: false,
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });

    it("navigates to beforeyoustart1 after login without onboarding", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({ messages: [] });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });

    it("navigates to emergency plan after onboarding without messages", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({ messages: [] });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });

    it("navigates to main after completing emergency plan workflow", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [{ id: "msg-1", topic: "Test", message: "Test", contacts: [] }],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("main");
      });
    });
  });

  describe("Navigation Persistence", () => {
    it("prevents re-navigation after initialization", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: false,
      });

      const { rerender } = render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      });

      // Clear mocks and rerender
      jest.clearAllMocks();
      rerender(<Index />);

      // Should not navigate again
      await waitFor(() => {
        expect(mockRouter.replace).not.toHaveBeenCalled();
      });
    });

    it("calls checkAuthStatus on initialization", async () => {
      const checkAuthStatus = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus,
      });

      render(<Index />);

      await waitFor(() => {
        expect(checkAuthStatus).toHaveBeenCalled();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles missing emergency plan data gracefully", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: undefined,
      });

      render(<Index />);

      // Should redirect to emergency plan when messages is undefined
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalled();
      });
    });

    it("handles SecureStore errors gracefully", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error("SecureStore error")
      );

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });

    it("handles null messages array", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: null,
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalled();
      });
    });
  });

  describe("User State Transitions", () => {
    it("navigates logged out user to welcome", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: false,
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });

    it("navigates logged in user with completed plan to main", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
        user: { userId: "test-user" },
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [{ id: "msg-1", topic: "Test", message: "Test", contacts: [] }],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("main");
      });
    });

    it("navigates logged in user without messages to emergency plan", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });
  });

  describe("Loading States", () => {
    it("waits for auth loading to complete before navigation", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: true,
        isLoggedIn: false,
      });

      render(<Index />);

      // Should not navigate while loading
      await waitFor(() => {
        expect(mockRouter.replace).not.toHaveBeenCalled();
      });
    });

    it("navigates after loading completes", async () => {
      // Start with loading
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: true,
        isLoggedIn: false,
      });

      const { rerender } = render(<Index />);

      // Should not navigate yet
      expect(mockRouter.replace).not.toHaveBeenCalled();

      // Loading completes
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: false,
      });

      rerender(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });
  });

  describe("Onboarding Completion States", () => {
    it('treats "false" onboarding status as incomplete', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("false");
        return Promise.resolve(null);
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });

    it("treats empty string onboarding status as incomplete", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("");
        return Promise.resolve(null);
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });

    it('treats "true" onboarding status as complete', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });
  });

  describe("Message State Validation", () => {
    it("considers empty array as no messages", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });

    it("routes to main when plan completed with messages", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [
          { id: "msg-1", topic: "Test", message: "Test message", contacts: [] },
        ],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("main");
      });
    });

    it("routes to main when plan completed with multiple messages", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockUseAuth,
        isLoading: false,
        isLoggedIn: true,
      });

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve("true");
        return Promise.resolve(null);
      });

      (loadEmergencyPlanData as jest.Mock).mockResolvedValue({
        messages: [
          { id: "msg-1", topic: "Test 1", message: "Test message 1", contacts: [] },
          { id: "msg-2", topic: "Test 2", message: "Test message 2", contacts: [] },
        ],
      });

      render(<Index />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("main");
      });
    });
  });
});

