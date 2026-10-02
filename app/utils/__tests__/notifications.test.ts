// Set up environment variables before any imports
// Now import after all mocks are set up
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import {
  registerDevicePushToken,
  disableDevicePushToken,
  getStoredPushTokenHash,
  getLastRegistrationTimestamp,
} from "../notifications";
import * as encryptionUtils from "../encryption-utils";
import * as secureRandom from "../secureRandom";
import * as notificationService from "../../services/notification-service";

process.env.EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL =
  "https://test.twil.io/notification-manager";
process.env.EXPO_PUBLIC_TWILIO_API_SECRET = "test-secret-key";

// Mock expo-notifications before importing
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: {
    MAX: 5,
  },
  AndroidNotificationVisibility: {
    PUBLIC: 1,
  },
}));

// Mock other Expo modules
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-constants", () => {
  const mockConstants = {
    expoConfig: {
      version: "1.0.0",
      extra: {
        eas: {
          projectId: "test-project-id",
        },
      },
    },
    easConfig: {
      projectId: "test-project-id",
    },
  };
  return {
    __esModule: true,
    default: mockConstants,
    ...mockConstants,
  };
});

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: "SHA-256",
  },
}));

jest.mock("../encryption-utils", () => ({
  authenticateWithDeviceLock: jest.fn(),
  encryptData: jest.fn(),
}));

jest.mock("../secureRandom", () => ({
  generateSecureUUID: jest.fn(),
}));

jest.mock("../../services/notification-service", () => ({
  registerPushToken: jest.fn(),
  disablePushToken: jest.fn(),
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

describe("notifications utility", () => {
  const mockExpoPushToken = "ExponentPushToken[test123abc]";
  const mockDeviceId = "device-uuid-123";
  const mockTokenHash = "hash123abc";

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: mockExpoPushToken,
    });
    (Notifications.setNotificationChannelAsync as jest.Mock).mockResolvedValue(
      undefined
    );
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue(mockTokenHash);
    (encryptionUtils.encryptData as jest.Mock).mockResolvedValue(
      "encrypted-token"
    );
    (encryptionUtils.authenticateWithDeviceLock as jest.Mock).mockResolvedValue(
      true
    );
    (secureRandom.generateSecureUUID as jest.Mock).mockReturnValue(mockDeviceId);
    (notificationService.registerPushToken as jest.Mock).mockResolvedValue({
      success: true,
      statusCode: 200,
    });
    (notificationService.disablePushToken as jest.Mock).mockResolvedValue({
      success: true,
      statusCode: 200,
    });
  });

  describe("registerDevicePushToken", () => {
    const defaultOptions = {
      force: false,
      requireBiometric: false,
      language: "en" as const,
      userId: "user-123",
    };

    it("should successfully register a new push token", async () => {
      const result = await registerDevicePushToken(defaultOptions);

      expect(result).toEqual({
        outcome: "success",
        detail: "registered",
      });

      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: "test-project-id",
      });
      expect(notificationService.registerPushToken).toHaveBeenCalledWith(
        expect.objectContaining({
          expoPushToken: mockExpoPushToken,
          deviceId: mockDeviceId,
          tokenHash: mockTokenHash,
          language: "en",
          notificationsEnabled: true,
          platform: Platform.OS,
        })
      );
    });

    it("should request permission if not granted", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const result = await registerDevicePushToken(defaultOptions);

      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
      expect(result.outcome).toBe("success");
    });

    it("should skip if permission is denied", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      const result = await registerDevicePushToken(defaultOptions);

      expect(result).toEqual({
        outcome: "skipped",
        reason: "permission-denied",
      });
      expect(notificationService.registerPushToken).not.toHaveBeenCalled();
    });

    it("should require biometric authentication when specified", async () => {
      const result = await registerDevicePushToken({
        ...defaultOptions,
        requireBiometric: true,
      });

      expect(encryptionUtils.authenticateWithDeviceLock).toHaveBeenCalled();
      expect(result.outcome).toBe("success");
    });

    it("should skip if biometric authentication fails", async () => {
      (
        encryptionUtils.authenticateWithDeviceLock as jest.Mock
      ).mockResolvedValue(false);

      const result = await registerDevicePushToken({
        ...defaultOptions,
        requireBiometric: true,
      });

      expect(result).toEqual({
        outcome: "skipped",
        reason: "biometric",
      });
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    it("should skip registration if token hash is unchanged and force is false", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "push_token_hash") return Promise.resolve(mockTokenHash);
        return Promise.resolve(null);
      });

      const result = await registerDevicePushToken({
        ...defaultOptions,
        force: false,
      });

      expect(result).toEqual({
        outcome: "success",
        detail: "unchanged",
      });
      expect(notificationService.registerPushToken).not.toHaveBeenCalled();
    });

    it("should force registration even if token hash is unchanged", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "push_token_hash") return Promise.resolve(mockTokenHash);
        return Promise.resolve(null);
      });

      const result = await registerDevicePushToken({
        ...defaultOptions,
        force: true,
      });

      expect(result.outcome).toBe("success");
      expect(result.detail).toBe("registered");
      expect(notificationService.registerPushToken).toHaveBeenCalled();
    });

    it("should return error if service registration fails", async () => {
      (notificationService.registerPushToken as jest.Mock).mockResolvedValue({
        success: false,
        error: "Server error",
      });

      const result = await registerDevicePushToken(defaultOptions);

      expect(result).toEqual({
        outcome: "error",
        reason: "network",
        message: "Server error",
      });
    });

    it("should store token securely after registration", async () => {
      await registerDevicePushToken(defaultOptions);

      expect(encryptionUtils.encryptData).toHaveBeenCalledWith(
        mockExpoPushToken
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "push_token_encrypted",
        "encrypted-token"
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "push_token_hash",
        mockTokenHash
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "push_token_last_registered",
        expect.any(String)
      );
    });
  });

  describe("disableDevicePushToken", () => {
    const defaultOptions = {
      requireBiometric: false,
      userId: "user-123",
    };

    beforeEach(() => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === "push_device_identifier") return Promise.resolve(mockDeviceId);
        if (key === "push_token_hash") return Promise.resolve(mockTokenHash);
        return Promise.resolve(null);
      });
    });

    it("should successfully disable push token", async () => {
      const result = await disableDevicePushToken(defaultOptions);

      expect(result).toEqual({
        outcome: "success",
        detail: "disabled",
      });

      expect(notificationService.disablePushToken).toHaveBeenCalledWith({
        deviceId: mockDeviceId,
        tokenHash: mockTokenHash,
        userHash: expect.any(String),
      });
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "push_token_encrypted"
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("push_token_hash");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "push_token_last_registered"
      );
    });

    it("should require biometric authentication when specified", async () => {
      const result = await disableDevicePushToken({
        ...defaultOptions,
        requireBiometric: true,
      });

      expect(encryptionUtils.authenticateWithDeviceLock).toHaveBeenCalled();
      expect(result.outcome).toBe("success");
    });

    it("should skip if biometric authentication fails", async () => {
      (
        encryptionUtils.authenticateWithDeviceLock as jest.Mock
      ).mockResolvedValue(false);

      const result = await disableDevicePushToken({
        ...defaultOptions,
        requireBiometric: true,
      });

      expect(result).toEqual({
        outcome: "skipped",
        reason: "biometric",
      });
      expect(notificationService.disablePushToken).not.toHaveBeenCalled();
    });

    it("should succeed even if device ID is not found", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await disableDevicePushToken(defaultOptions);

      expect(result).toEqual({
        outcome: "success",
        detail: "disabled",
      });
      expect(notificationService.disablePushToken).not.toHaveBeenCalled();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it("should return error if service disable fails", async () => {
      (notificationService.disablePushToken as jest.Mock).mockResolvedValue({
        success: false,
        error: "Server error",
      });

      const result = await disableDevicePushToken(defaultOptions);

      expect(result).toEqual({
        outcome: "error",
        reason: "network",
        message: "Server error",
      });
    });
  });

  describe("getStoredPushTokenHash", () => {
    it("should retrieve stored token hash", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockTokenHash);

      const result = await getStoredPushTokenHash();

      expect(result).toBe(mockTokenHash);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith("push_token_hash");
    });

    it("should return null if no hash is stored", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await getStoredPushTokenHash();

      expect(result).toBeNull();
    });
  });

  describe("getLastRegistrationTimestamp", () => {
    it("should retrieve last registration timestamp", async () => {
      const mockTimestamp = "2025-11-20T12:00:00.000Z";
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockTimestamp);

      const result = await getLastRegistrationTimestamp();

      expect(result).toBe(mockTimestamp);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        "push_token_last_registered"
      );
    });

    it("should return null if no timestamp is stored", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await getLastRegistrationTimestamp();

      expect(result).toBeNull();
    });
  });
});
