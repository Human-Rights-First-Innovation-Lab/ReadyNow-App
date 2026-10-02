import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { authenticateWithDeviceLock, encryptData } from "./encryption-utils";
import { generateSecureUUID } from "./secureRandom";
import {
  disablePushToken,
  registerPushToken,
} from "../services/notification-service";
import type { AppLanguage } from "./app-settings";

const PUSH_TOKEN_KEY = "push_token_encrypted";
const PUSH_TOKEN_HASH_KEY = "push_token_hash";
const DEVICE_ID_KEY = "push_device_identifier";
const LAST_REGISTERED_AT_KEY = "push_token_last_registered";

type NotificationOutcome = "success" | "skipped" | "error";
type NotificationReason =
  | "permission-denied"
  | "biometric"
  | "config"
  | "network"
  | "unknown";

export interface NotificationResult {
  outcome: NotificationOutcome;
  reason?: NotificationReason;
  detail?: "registered" | "unchanged" | "disabled";
  message?: string;
}

interface RegisterOptions {
  force?: boolean;
  requireBiometric?: boolean;
  language: AppLanguage;
  userId?: string;
}

interface DisableOptions {
  requireBiometric?: boolean;
  userId?: string;
}

const ensureAndroidNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

const getOrCreateDeviceId = async (): Promise<string> => {
  const existingId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const newId = generateSecureUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
  return newId;
};

const hashValue = async (value: string): Promise<string> => {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
};

const getProjectId = (): string | null => {
  const expoConfigProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null;

  return expoConfigProjectId;
};

const storeTokenSecurely = async (
  token: string,
  tokenHash: string
): Promise<void> => {
  const encryptedToken = await encryptData(token);
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, encryptedToken);
  await SecureStore.setItemAsync(PUSH_TOKEN_HASH_KEY, tokenHash);
  await SecureStore.setItemAsync(
    LAST_REGISTERED_AT_KEY,
    new Date().toISOString()
  );
};

const clearStoredToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PUSH_TOKEN_HASH_KEY);
  await SecureStore.deleteItemAsync(LAST_REGISTERED_AT_KEY);
};

export const registerDevicePushToken = async (
  options: RegisterOptions
): Promise<NotificationResult> => {
  const { force = false, requireBiometric = false, language, userId } = options;

  if (requireBiometric) {
    const authenticated = await authenticateWithDeviceLock();
    if (!authenticated) {
      return {
        outcome: "skipped",
        reason: "biometric",
      };
    }
  }

  try {
    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;

    if (finalStatus !== "granted") {
      const requestResult = await Notifications.requestPermissionsAsync();
      finalStatus = requestResult.status;
    }

    if (finalStatus !== "granted") {
      return {
        outcome: "skipped",
        reason: "permission-denied",
      };
    }
  } catch (error) {
    return {
      outcome: "error",
      reason: "unknown",
      message:
        error instanceof Error
          ? error.message
          : "Unknown error requesting notification permissions",
    };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return {
      outcome: "error",
      reason: "config",
      message: "Missing Expo project ID",
    };
  }

  try {
    await ensureAndroidNotificationChannel();
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const expoPushToken = tokenResponse.data;

    const tokenHash = await hashValue(expoPushToken);
    const storedHash = await SecureStore.getItemAsync(PUSH_TOKEN_HASH_KEY);

    if (storedHash === tokenHash && !force) {
      return {
        outcome: "success",
        detail: "unchanged",
      };
    }

    await storeTokenSecurely(expoPushToken, tokenHash);

    const deviceId = await getOrCreateDeviceId();
    const userHash =
      userId && userId.length > 0 ? await hashValue(userId) : undefined;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const serviceResponse = await registerPushToken({
      expoPushToken,
      deviceId,
      tokenHash,
      language,
      notificationsEnabled: true,
      userHash,
      appVersion: Constants.expoConfig?.version,
      timezone,
      platform: Platform.OS,
    });

    if (!serviceResponse.success) {
      return {
        outcome: "error",
        reason: "network",
        message: serviceResponse.error,
      };
    }

    return {
      outcome: "success",
      detail: "registered",
    };
  } catch (error) {
    return {
      outcome: "error",
      reason: "unknown",
      message:
        error instanceof Error
          ? error.message
          : "Unknown error registering device token",
    };
  }
};

export const disableDevicePushToken = async (
  options: DisableOptions
): Promise<NotificationResult> => {
  const { requireBiometric = false, userId } = options;

  if (requireBiometric) {
    const authenticated = await authenticateWithDeviceLock();
    if (!authenticated) {
      return {
        outcome: "skipped",
        reason: "biometric",
      };
    }
  }

  try {
    const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    const tokenHash = await SecureStore.getItemAsync(PUSH_TOKEN_HASH_KEY);

    if (!deviceId || !tokenHash) {
      await clearStoredToken();
      return {
        outcome: "success",
        detail: "disabled",
      };
    }

    const userHash =
      userId && userId.length > 0 ? await hashValue(userId) : undefined;

    const serviceResponse = await disablePushToken({
      deviceId,
      tokenHash,
      userHash,
    });

    if (!serviceResponse.success) {
      return {
        outcome: "error",
        reason: "network",
        message: serviceResponse.error,
      };
    }

    await clearStoredToken();

    return {
      outcome: "success",
      detail: "disabled",
    };
  } catch (error) {
    return {
      outcome: "error",
      reason: "unknown",
      message:
        error instanceof Error
          ? error.message
          : "Unknown error disabling device token",
    };
  }
};

export const getStoredPushTokenHash = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(PUSH_TOKEN_HASH_KEY);
};

export const getLastRegistrationTimestamp = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(LAST_REGISTERED_AT_KEY);
};

