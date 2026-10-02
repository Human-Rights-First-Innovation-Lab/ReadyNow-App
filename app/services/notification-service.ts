import { Platform } from "react-native";

import type { AppLanguage } from "../utils/app-settings";

interface NotificationServiceResponse {
  success: boolean;
  error?: string;
  statusCode?: number;
}

interface RegisterPushTokenRequest {
  expoPushToken: string;
  deviceId: string;
  tokenHash: string;
  language: AppLanguage;
  notificationsEnabled: boolean;
  userHash?: string;
  appVersion?: string;
  timezone?: string;
  platform: typeof Platform.OS;
}

interface DisablePushTokenRequest {
  deviceId: string;
  tokenHash?: string;
  userHash?: string;
}

const TWILIO_NOTIFICATION_HANDLER_URL =
  process.env.EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL;
const TWILIO_NOTIFICATION_API_SECRET =
  process.env.EXPO_PUBLIC_TWILIO_API_SECRET;

const ensureConfiguration = (): void => {
  if (!TWILIO_NOTIFICATION_HANDLER_URL) {
    throw new Error("Notification Twilio function URL not configured");
  }

  if (!TWILIO_NOTIFICATION_API_SECRET) {
    throw new Error("Twilio API secret not configured");
  }
};

const toServiceResponse = (
  response: Response
): NotificationServiceResponse => {
  if (response.ok) {
    return {
      success: true,
      statusCode: response.status,
    };
  }

  return {
    success: false,
    statusCode: response.status,
    error: `Notification service returned status ${response.status}`,
  };
};

export const registerPushToken = async (
  request: RegisterPushTokenRequest
): Promise<NotificationServiceResponse> => {
  ensureConfiguration();

  try {
    const response = await fetch(TWILIO_NOTIFICATION_HANDLER_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "register",
        apiKey: TWILIO_NOTIFICATION_API_SECRET,
        payload: request,
      }),
    });

    return toServiceResponse(response);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error registering push token",
    };
  }
};

export const disablePushToken = async (
  request: DisablePushTokenRequest
): Promise<NotificationServiceResponse> => {
  ensureConfiguration();

  try {
    const response = await fetch(TWILIO_NOTIFICATION_HANDLER_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "disable",
        apiKey: TWILIO_NOTIFICATION_API_SECRET,
        payload: request,
      }),
    });

    return toServiceResponse(response);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error disabling push token",
    };
  }
};

export default {
  registerPushToken,
  disablePushToken,
};

