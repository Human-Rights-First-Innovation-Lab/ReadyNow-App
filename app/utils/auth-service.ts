import Auth0 from "react-native-auth0";
import * as SecureStore from "expo-secure-store";
import { AUTH0_CONFIG, formatPhoneNumberForAuth0 } from "./auth-config";

// Initialize Auth0 client
const auth0 = new Auth0({
  domain: AUTH0_CONFIG.domain,
  clientId: AUTH0_CONFIG.clientId,
});

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_INFO: "user_info",
  SESSION_TOKEN: "session_token",
  ONBOARDING_COMPLETED: "hasCompletedOnboarding",
  INTENDED_TAB: "intended_tab",
};

// Type for user info
export interface UserInfo {
  phone: string;
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  name?: string;
}

/**
 * Request SMS code for phone number verification
 */
export const requestSmsCode = async (phoneNumber: string): Promise<boolean> => {
  try {
    const formattedNumber = formatPhoneNumberForAuth0(phoneNumber);
    
    // Use react-native-auth0 for password-less login
    await auth0.auth.passwordlessWithSMS({
      phoneNumber: formattedNumber,
    });
    
    return true;
  } catch (error) {
    console.error("Error requesting SMS code:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to send verification code");
  }
};

/**
 * Verify OTP code and complete authentication
 */
export const verifyOtpCode = async (phoneNumber: string, code: string): Promise<UserInfo> => {
  try {
    const formattedNumber = formatPhoneNumberForAuth0(phoneNumber);
    
    // Login with SMS code
    const credentials = await auth0.auth.loginWithSMS({
      phoneNumber: formattedNumber,
      code,
    });
    
    if (!credentials.accessToken) {
      throw new Error("No access token received");
    }

    // Save tokens to secure storage
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, credentials.accessToken);
    if (credentials.refreshToken) {
      await SecureStore.setItemAsync("refresh_token", credentials.refreshToken);
    }

    // Also hand these to Auth0's own credentials manager. Nothing else in this
    // file ever mints a new access token from the refresh token - the raw
    // SecureStore copy above is a snapshot of this moment and goes stale in
    // hours. getFreshAccessToken() below is what the alert-credential healing
    // path uses instead, precisely so it is not still reading this snapshot
    // weeks later. Best-effort: sign-in must not fail because of this.
    try {
      await auth0.credentialsManager.saveCredentials(credentials);
    } catch (error) {
      console.error(
        "Could not save credentials to the credentials manager:",
        error instanceof Error ? error.message : String(error)
      );
    }
    
    // Get user info
    const userInfo = await auth0.auth.userInfo({ token: credentials.accessToken });
    
    // Format user info for our app
    const appUserInfo: UserInfo = {
      phone: formattedNumber,
      isAuthenticated: true,
      userId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
    };
    
    // Save user info to secure storage
    await SecureStore.setItemAsync(
      STORAGE_KEYS.USER_INFO, 
      JSON.stringify(appUserInfo)
    );
    
    // Check if this is a first login (new user)
    // If we've never set the onboarding status, mark as new user
    const existingOnboardingValue = await SecureStore.getItemAsync(
      STORAGE_KEYS.ONBOARDING_COMPLETED
    );
    
    if (!existingOnboardingValue) {
      await SecureStore.setItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED, "false");
    }
    
    return appUserInfo;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to verify code");
  }
};

/**
 * A currently-valid Auth0 access token, refreshing via the stored refresh
 * token if the last one has expired.
 *
 * This exists because a raw access token read from SecureStore is only ever
 * as fresh as the moment it was written - the app never rewrites it after
 * login. `alert_credential` registration cannot rely on that: this app is
 * installed, configured, and often not opened again until an emergency, by
 * which point any access token minted at signup is long dead. Access tokens
 * live hours; refresh tokens can be configured to live far longer, which is
 * the whole point of going through this instead of SecureStore directly.
 *
 * Returns null - never throws - if there is no saved session or the refresh
 * token itself has expired or been revoked. That is a real "not logged in
 * anymore" state, not a transient failure to retry.
 */
export const getFreshAccessToken = async (): Promise<string | null> => {
  try {
    const credentials = await auth0.credentialsManager.getCredentials();
    return credentials.accessToken;
  } catch (error) {
    console.error(
      "Could not obtain a fresh access token:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
};

/** How long to wait for Auth0 to acknowledge a revocation before giving up. */
const REVOCATION_TIMEOUT_MS = 5000;

/**
 * Ask Auth0 to invalidate a refresh token server-side.
 *
 * Deleting the token locally only removes this device's copy. Until it is
 * revoked it remains exchangeable for fresh access tokens by anyone who
 * extracted it - from a device backup, or from a phone that was taken. Someone
 * signing out because they are about to lose control of their phone is doing
 * it for exactly that reason, so the local delete alone is not enough.
 *
 * Best effort by design: bounded by a timeout, and never allowed to block or
 * fail the sign-out itself. AUTH0_CONFIG.clientId is a public native client,
 * so no client secret is involved.
 */
const revokeRefreshToken = async (refreshToken: string): Promise<void> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVOCATION_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://${AUTH0_CONFIG.domain}/oauth/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: AUTH0_CONFIG.clientId,
          token: refreshToken,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      // The status is safe to log; the body is not, and is not read.
      console.error(
        `Refresh token revocation failed with status ${response.status}`
      );
    }
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Sign out the user.
 *
 * Local credentials are cleared first and unconditionally, so a network
 * failure, a slow response or an offline device can never leave tokens behind
 * on the handset. Revocation is attempted afterwards with the value read
 * before deletion.
 */
export const clearLocalSession = async (): Promise<string | null> => {
  let refreshToken: string | null = null;

  try {
    refreshToken = await SecureStore.getItemAsync("refresh_token");
  } catch (error) {
    // Fall through: a token we cannot read is one we cannot revoke, but the
    // deletes below must still run.
    console.error(
      "Could not read refresh token before sign out:",
      error instanceof Error ? error.message : String(error)
    );
  }

  try {
    // Clear all auth related data
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_INFO);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.INTENDED_TAB);
    await SecureStore.deleteItemAsync("refresh_token");

    // Keep the credentials manager's own store in sync with the manual keys
    // above - otherwise a "signed out" device still holds a working,
    // self-refreshing credential in a second location.
    try {
      await auth0.credentialsManager.clearCredentials();
    } catch (error) {
      console.error(
        "Could not clear the credentials manager:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Onboarding status is deliberately left alone here. Only the post-alert
    // reset clears it, because only that path is meant to return the app to a
    // freshly installed state.
  } catch (error) {
    console.error("Error signing out:", error);
  }

  return refreshToken;
};

/**
 * Best-effort revocation of a refresh token already removed from the device.
 *
 * Separate from clearLocalSession so a caller that must not block - the alert
 * path, where the handset may be seized at any moment - can clear the session
 * synchronously and leave revocation to finish on its own.
 */
export const revokeRefreshTokenBestEffort = async (
  refreshToken: string
): Promise<void> => {
  try {
    await revokeRefreshToken(refreshToken);
  } catch (error) {
    // Includes the timeout abort. The device is already signed out.
    console.error(
      "Refresh token revocation failed:",
      error instanceof Error ? error.message : String(error)
    );
  }
};

export const signOut = async (): Promise<void> => {
  const refreshToken = await clearLocalSession();
  if (refreshToken) await revokeRefreshTokenBestEffort(refreshToken);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  } catch (error) {
    return false;
  }
};

/**
 * Get current user info
 */
export const getCurrentUser = async (): Promise<UserInfo | null> => {
  try {
    const userInfoStr = await SecureStore.getItemAsync(STORAGE_KEYS.USER_INFO);
    if (!userInfoStr) return null;
    
    return JSON.parse(userInfoStr) as UserInfo;
  } catch (error) {
    console.error("Error getting user info:", error);
    return null;
  }
}; 

export default {
  requestSmsCode,
  verifyOtpCode,
  signOut,
  clearLocalSession,
  revokeRefreshTokenBestEffort,
  isAuthenticated,
};