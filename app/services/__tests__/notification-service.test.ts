// Mock fetch globally before any imports
global.fetch = jest.fn();

// Mock Platform.OS
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

describe("notification-service", () => {
  const mockEnvVars = {
    EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL:
      "https://test.twil.io/notification-manager",
    EXPO_PUBLIC_TWILIO_API_SECRET: "test-secret-key",
  };

  let registerPushToken: any;
  let disablePushToken: any;

  beforeAll(() => {
    // Set environment variables before requiring the module
    process.env.EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL =
      mockEnvVars.EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL;
    process.env.EXPO_PUBLIC_TWILIO_API_SECRET =
      mockEnvVars.EXPO_PUBLIC_TWILIO_API_SECRET;

    // Now require the module with env vars set
    const service = require("../notification-service");
    registerPushToken = service.registerPushToken;
    disablePushToken = service.disablePushToken;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerPushToken", () => {
    const mockRequest = {
      expoPushToken: "ExponentPushToken[test123]",
      deviceId: "device-uuid-123",
      tokenHash: "hash123",
      language: "en" as const,
      notificationsEnabled: true,
      platform: "ios" as const,
    };

    it("should successfully register a push token", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const result = await registerPushToken(mockRequest);

      expect(result).toEqual({
        success: true,
        statusCode: 200,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        mockEnvVars.EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "register",
            apiKey: mockEnvVars.EXPO_PUBLIC_TWILIO_API_SECRET,
            payload: mockRequest,
          }),
        }
      );
    });

    it("should include optional fields when provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const requestWithOptionals = {
        ...mockRequest,
        userHash: "user-hash-456",
        appVersion: "1.0.0",
        timezone: "America/New_York",
      };

      await registerPushToken(requestWithOptionals);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const bodyPayload = JSON.parse(callArgs[1].body);

      expect(bodyPayload.payload.userHash).toBe("user-hash-456");
      expect(bodyPayload.payload.appVersion).toBe("1.0.0");
      expect(bodyPayload.payload.timezone).toBe("America/New_York");
    });

    it("should handle server error responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "Internal server error" }),
      });

      const result = await registerPushToken(mockRequest);

      expect(result).toEqual({
        success: false,
        statusCode: 500,
        error: "Notification service returned status 500",
      });
    });

    it("should handle unauthorized responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: "Unauthorized" }),
      });

      const result = await registerPushToken(mockRequest);

      expect(result).toEqual({
        success: false,
        statusCode: 401,
        error: "Notification service returned status 401",
      });
    });

    it("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network request failed")
      );

      const result = await registerPushToken(mockRequest);

      expect(result).toEqual({
        success: false,
        error: "Network request failed",
      });
    });

    it("should handle non-Error exceptions", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce("String error");

      const result = await registerPushToken(mockRequest);

      expect(result).toEqual({
        success: false,
        error: "Unknown error registering push token",
      });
    });

    it("should send correct action in request body", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await registerPushToken(mockRequest);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const bodyPayload = JSON.parse(callArgs[1].body);

      expect(bodyPayload.action).toBe("register");
    });
  });

  describe("disablePushToken", () => {
    const mockRequest = {
      deviceId: "device-uuid-123",
    };

    it("should successfully disable a push token", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const result = await disablePushToken(mockRequest);

      expect(result).toEqual({
        success: true,
        statusCode: 200,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        mockEnvVars.EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "disable",
            apiKey: mockEnvVars.EXPO_PUBLIC_TWILIO_API_SECRET,
            payload: mockRequest,
          }),
        }
      );
    });

    it("should include optional tokenHash when provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const requestWithHash = {
        ...mockRequest,
        tokenHash: "hash123",
      };

      await disablePushToken(requestWithHash);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const bodyPayload = JSON.parse(callArgs[1].body);

      expect(bodyPayload.payload.tokenHash).toBe("hash123");
    });

    it("should include optional userHash when provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const requestWithUserHash = {
        ...mockRequest,
        userHash: "user-hash-456",
      };

      await disablePushToken(requestWithUserHash);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const bodyPayload = JSON.parse(callArgs[1].body);

      expect(bodyPayload.payload.userHash).toBe("user-hash-456");
    });

    it("should handle server error responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "Internal server error" }),
      });

      const result = await disablePushToken(mockRequest);

      expect(result).toEqual({
        success: false,
        statusCode: 500,
        error: "Notification service returned status 500",
      });
    });

    it("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network request failed")
      );

      const result = await disablePushToken(mockRequest);

      expect(result).toEqual({
        success: false,
        error: "Network request failed",
      });
    });

    it("should handle non-Error exceptions", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce("String error");

      const result = await disablePushToken(mockRequest);

      expect(result).toEqual({
        success: false,
        error: "Unknown error disabling push token",
      });
    });

    it("should send correct action in request body", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await disablePushToken(mockRequest);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const bodyPayload = JSON.parse(callArgs[1].body);

      expect(bodyPayload.action).toBe("disable");
    });
  });

  describe("API request format", () => {
    it("should use POST method for all requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await registerPushToken({
        expoPushToken: "ExponentPushToken[test]",
        deviceId: "device-123",
        tokenHash: "hash123",
        language: "en",
        notificationsEnabled: true,
        platform: "ios",
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[1].method).toBe("POST");
    });

    it("should set correct Content-Type header", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await registerPushToken({
        expoPushToken: "ExponentPushToken[test]",
        deviceId: "device-123",
        tokenHash: "hash123",
        language: "en",
        notificationsEnabled: true,
        platform: "ios",
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
    });

    it("should include apiKey in request body", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await registerPushToken({
        expoPushToken: "ExponentPushToken[test]",
        deviceId: "device-123",
        tokenHash: "hash123",
        language: "en",
        notificationsEnabled: true,
        platform: "ios",
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const bodyPayload = JSON.parse(callArgs[1].body);

      expect(bodyPayload.apiKey).toBe("test-secret-key");
    });
  });

  describe("error handling", () => {
    it("should handle timeout errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Request timeout")
      );

      const result = await registerPushToken({
        expoPushToken: "ExponentPushToken[test]",
        deviceId: "device-123",
        tokenHash: "hash123",
        language: "en",
        notificationsEnabled: true,
        platform: "ios",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });

    it("should handle malformed response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const result = await registerPushToken({
        expoPushToken: "ExponentPushToken[test]",
        deviceId: "device-123",
        tokenHash: "hash123",
        language: "en",
        notificationsEnabled: true,
        platform: "ios",
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });
  });
});
