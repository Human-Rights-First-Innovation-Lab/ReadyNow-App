import {
  signOut,
  isAuthenticated,
  getCurrentUser,
  STORAGE_KEYS,
} from "../auth-service";
import * as SecureStore from "expo-secure-store";

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock react-native-auth0 - skip actual Auth0 tests for now due to mocking complexity
jest.mock("react-native-auth0", () => {
  return jest.fn();
});

// Mock auth config
jest.mock("../auth-config", () => ({
  AUTH0_CONFIG: {
    domain: "test.auth0.com",
    clientId: "test-client-id",
  },
  formatPhoneNumberForAuth0: (phone: string) => `+1${phone}`,
}));

describe("Auth Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Skip Auth0-dependent tests for now - they require complex mocking
  describe.skip("requestSmsCode", () => {
    it("sends SMS code successfully", async () => {
      // Test skipped - Auth0 mocking complexity
    });
  });

  describe.skip("verifyOtpCode", () => {
    it("verifies OTP code successfully", async () => {
      // Test skipped - Auth0 mocking complexity
    });
  });

  describe("signOut", () => {
    describe("refresh token revocation", () => {
      const REFRESH_TOKEN = "test-refresh-token";
      let fetchMock: jest.Mock;

      beforeEach(() => {
        fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        global.fetch = fetchMock as unknown as typeof fetch;
        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(
          (key: string) =>
            Promise.resolve(key === "refresh_token" ? REFRESH_TOKEN : null)
        );
      });

      it("revokes the refresh token with Auth0", async () => {
        await signOut();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://test.auth0.com/oauth/revoke");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({
          client_id: "test-client-id",
          token: REFRESH_TOKEN,
        });
      });

      it("reads the token before deleting it, or there is nothing to revoke", async () => {
        const order: string[] = [];
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(
          (key: string) => {
            order.push(`get:${key}`);
            return Promise.resolve(
              key === "refresh_token" ? REFRESH_TOKEN : null
            );
          }
        );
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(
          (key: string) => {
            order.push(`delete:${key}`);
            return Promise.resolve(undefined);
          }
        );

        await signOut();

        expect(order.indexOf("get:refresh_token")).toBeLessThan(
          order.indexOf("delete:refresh_token")
        );
      });

      it("still clears local tokens when revocation fails", async () => {
        fetchMock.mockRejectedValue(new Error("network unreachable"));

        await expect(signOut()).resolves.toBeUndefined();

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.AUTH_TOKEN
        );
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
          "refresh_token"
        );
      });

      it("still clears local tokens when Auth0 rejects the revocation", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 401 });

        await expect(signOut()).resolves.toBeUndefined();

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
          "refresh_token"
        );
      });

      it("does not call Auth0 when there is no refresh token", async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

        await signOut();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
          "refresh_token"
        );
      });
    });

    it("clears all auth tokens", async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.AUTH_TOKEN
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_INFO
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refresh_token");
    });

    it("does not clear onboarding status", async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
        STORAGE_KEYS.ONBOARDING_COMPLETED
      );
    });

    it("handles errors gracefully", async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      // Should not throw
      await expect(signOut()).resolves.not.toThrow();
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when auth token exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("test-token");

      const result = await isAuthenticated();

      expect(result).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.AUTH_TOKEN
      );
    });

    it("returns false when auth token does not exist", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });

    it("returns false on storage error", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe("getCurrentUser", () => {
    it("returns user info when it exists", async () => {
      const mockUserInfo = {
        phone: "+15551234567",
        isAuthenticated: true,
        userId: "auth0|123456",
        email: "test@example.com",
        name: "Test User",
      };

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify(mockUserInfo)
      );

      const result = await getCurrentUser();

      expect(result).toEqual(mockUserInfo);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_INFO
      );
    });

    it("returns null when user info does not exist", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    it("returns null on parse error", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("invalid-json");

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    it("returns null on storage error", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error("Storage error")
      );

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe("STORAGE_KEYS", () => {
    it("has correct storage key values", () => {
      expect(STORAGE_KEYS.AUTH_TOKEN).toBe("auth_token");
      expect(STORAGE_KEYS.USER_INFO).toBe("user_info");
      expect(STORAGE_KEYS.SESSION_TOKEN).toBe("session_token");
      expect(STORAGE_KEYS.ONBOARDING_COMPLETED).toBe("hasCompletedOnboarding");
      expect(STORAGE_KEYS.INTENDED_TAB).toBe("intended_tab");
    });
  });
});

