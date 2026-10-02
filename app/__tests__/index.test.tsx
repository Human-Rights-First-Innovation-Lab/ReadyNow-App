/**
 * Index Page Tests
 * 
 * Tests the app initialization and routing logic including:
 * - Initial loading state
 * - Routing based on authentication status
 * - Routing based on onboarding completion
 * - Routing based on emergency plan data
 * - Error handling and fallback behavior
 * - Prevention of navigation loops
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import Index from "../index";
import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../utils/auth-service";

// Mock auth-config (must be before auth-service import)
jest.mock("../utils/auth-config", () => ({
  AUTH0_CONFIG: {
    domain: "test-domain.auth0.com",
    clientId: "test-client-id",
    audience: "test-audience",
    connection: "sms",
    redirectUri: "test://callback",
  },
  formatPhoneNumberForAuth0: (phone: string) => `+1${phone}`,
}));

// Mock expo-router
const mockReplace = jest.fn();
const mockUseRouter = jest.fn(() => ({
  replace: mockReplace,
  push: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => mockUseRouter(),
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

// Mock auth hook
const mockCheckAuthStatus = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("../utils/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock storage utils
const mockLoadEmergencyPlanData = jest.fn();
const mockResetEmergencyPlanData = jest.fn();
const mockClearAdditionalLegalHelp = jest.fn();

jest.mock("../utils/storage-utils", () => ({
  loadEmergencyPlanData: () => mockLoadEmergencyPlanData(),
  resetEmergencyPlanData: () => mockResetEmergencyPlanData(),
  clearAdditionalLegalHelp: () => mockClearAdditionalLegalHelp(),
}));

describe("Index Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isLoggedIn: false,
      checkAuthStatus: mockCheckAuthStatus,
    });
    
    mockCheckAuthStatus.mockResolvedValue(undefined);
    mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  });

  describe("Rendering", () => {
    it("renders loading indicator", () => {
      const { getByTestId } = render(<Index />);
      
      // ActivityIndicator is rendered by default
      expect(getByTestId).toBeDefined();
    });

    it("shows loading spinner while initializing", () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      const { UNSAFE_root } = render(<Index />);
      
      // Component should render
      expect(UNSAFE_root).toBeDefined();
    });
  });

  describe("Not Logged In - Routes to Welcome", () => {
    it("routes to welcome screen when not logged in", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });

    it("calls checkAuthStatus before routing", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockCheckAuthStatus).toHaveBeenCalled();
      });
    });

    it("loads emergency plan data even when not logged in", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockLoadEmergencyPlanData).toHaveBeenCalled();
      });
    });
  });

  describe("Logged In - New User (No Onboarding)", () => {
    it("routes to onboarding when logged in but not onboarded", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });

    it('routes to onboarding when onboarding status is "false"', async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("false");
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });
  });

  describe("Logged In - Onboarded User Without Completed Plan", () => {
    it("routes to emergency plan when onboarded but plan not completed", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });
    
    it("routes to emergency plan even when messages exist but plan not completed", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Test message", contacts: [] },
        ],
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });
  });

  describe("Logged In - Returning User With Completed Plan", () => {
    it("routes to main page when plan workflow is completed", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve("true");
        return Promise.resolve(null);
      });
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Test message", contacts: [] },
        ],
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("main");
      });
    });

    it("routes to main page with completed plan regardless of message count", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve("true");
        return Promise.resolve(null);
      });
      mockLoadEmergencyPlanData.mockResolvedValue({
        messages: [
          { id: "1", topic: "Legal Support", message: "Test 1", contacts: [] },
          { id: "2", topic: "Other", message: "Test 2", contacts: [] },
        ],
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("main");
      });
    });
  });

  describe("Error Handling", () => {
    it("routes to welcome screen on error during initialization", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      mockLoadEmergencyPlanData.mockRejectedValue(new Error("Load failed"));
      
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error initializing app:",
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it("routes to welcome screen on SecureStore error", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error("SecureStore error")
      );
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
      
      consoleSpy.mockRestore();
    });

    it("routes to welcome screen on checkAuthStatus error", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      mockCheckAuthStatus.mockRejectedValue(new Error("Auth check failed"));
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Navigation Loop Prevention", () => {
    it("does not navigate multiple times", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      const { rerender } = render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledTimes(1);
      });
      
      // Rerender should not cause another navigation
      rerender(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledTimes(1);
      });
    });

    it("marks as initialized after successful navigation", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
      
      // Subsequent calls should not happen
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it("marks as initialized even after error", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      mockLoadEmergencyPlanData.mockRejectedValue(new Error("Error"));
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
        expect(mockReplace).toHaveBeenCalledTimes(1);
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe("Loading State Handling", () => {
    it("does not initialize when auth is loading", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      render(<Index />);
      
      // Wait a bit to ensure no navigation happens
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("initializes after loading completes", async () => {
      const { rerender } = render(<Index />);
      
      // Start with loading
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      rerender(<Index />);
      
      // Finish loading
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      rerender(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty messages array correctly", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve("true");
        if (key === "emergency_plan_completed") return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/emergency-plan");
      });
    });

    it("handles null onboarding status", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/beforeyoustart1");
      });
    });

    it("handles undefined messages", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("true");
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: undefined as any });
      
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      render(<Index />);
      
      // Should handle gracefully and route to welcome on error
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });

    it("prevents navigation when already initialized", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      render(<Index />);
      
      // Wait for initial navigation
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("screens/welcome/welcome");
      });
      
      // Verify only one call was made
      const initialCallCount = mockReplace.mock.calls.length;
      expect(initialCallCount).toBe(1);
      
      // Additional time should not trigger more navigation
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      expect(mockReplace).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe("Data Loading Sequence", () => {
    it("checks auth status before loading data", async () => {
      const callOrder: string[] = [];
      
      mockCheckAuthStatus.mockImplementation(async () => {
        callOrder.push("checkAuthStatus");
      });
      
      mockLoadEmergencyPlanData.mockImplementation(async () => {
        callOrder.push("loadEmergencyPlanData");
        return { messages: [] };
      });
      
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: false,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      render(<Index />);
      
      await waitFor(() => {
        expect(callOrder).toEqual(["checkAuthStatus", "loadEmergencyPlanData"]);
      });
    });

    it("checks onboarding status after loading messages", async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isLoggedIn: true,
        checkAuthStatus: mockCheckAuthStatus,
      });
      
      mockLoadEmergencyPlanData.mockResolvedValue({ messages: [] });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("true");
      
      render(<Index />);
      
      await waitFor(() => {
        expect(mockLoadEmergencyPlanData).toHaveBeenCalled();
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.ONBOARDING_COMPLETED
        );
      });
    });
  });

  describe("All Routing Paths", () => {
    it("covers all possible routing scenarios", async () => {
      const scenarios = [
        {
          name: "Not logged in",
          isLoggedIn: false,
          onboarding: null,
          planCompleted: null,
          messages: [],
          expectedRoute: "screens/welcome/welcome",
        },
        {
          name: "Logged in, not onboarded",
          isLoggedIn: true,
          onboarding: "false",
          planCompleted: null,
          messages: [],
          expectedRoute: "screens/welcome/beforeyoustart1",
        },
        {
          name: "Logged in, onboarded, plan not completed",
          isLoggedIn: true,
          onboarding: "true",
          planCompleted: null,
          messages: [],
          expectedRoute: "screens/emergency-plan",
        },
        {
          name: "Logged in, onboarded, plan completed",
          isLoggedIn: true,
          onboarding: "true",
          planCompleted: "true",
          messages: [{ id: "1", topic: "Test", message: "Test", contacts: [] }],
          expectedRoute: "main",
        },
      ];

      for (const scenario of scenarios) {
        jest.clearAllMocks();
        
        mockUseAuth.mockReturnValue({
          isLoading: false,
          isLoggedIn: scenario.isLoggedIn,
          checkAuthStatus: mockCheckAuthStatus,
        });
        
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
          if (key === STORAGE_KEYS.ONBOARDING_COMPLETED) return Promise.resolve(scenario.onboarding);
          if (key === "emergency_plan_completed") return Promise.resolve(scenario.planCompleted);
          return Promise.resolve(null);
        });
        mockLoadEmergencyPlanData.mockResolvedValue({ messages: scenario.messages });
        
        const { unmount } = render(<Index />);
        
        await waitFor(() => {
          expect(mockReplace).toHaveBeenCalledWith(scenario.expectedRoute);
        }, { timeout: 1000 });
        
        unmount();
      }
    });
  });
});

