import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

import { generateSecureBytes, generateSecureUUID } from "./secureRandom";
import { getFreshAccessToken } from "./auth-service";

/**
 * Per-install credential used to authenticate emergency alert calls.
 *
 * Deliberately not the Auth0 access token: those expire, and someone detained
 * weeks after last opening the app must still be able to fire an alert.
 * Depending on a token refresh succeeding at that exact moment is a failure
 * mode we can design out.
 *
 * This is also not a shared secret shipped in the bundle. Each install
 * generates its own random secret, registers only a hash of it, and can be
 * revoked individually.
 *
 * The credential survives wipeSensitiveData() on purpose - a user who has
 * fired one alert must still be able to fire another. It does NOT survive
 * resetToFreshInstall(), which runs once an alert has been handed off: at that
 * point the handset is assumed to be about to be seized, and a credential left
 * on it could fire further alerts in the user's name.
 */

const CREDENTIAL_ID_KEY = "alert_credential_id";
const CREDENTIAL_SECRET_KEY = "alert_credential_secret";

const SECRET_BYTES = 32;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** The bearer value sent to the alert endpoint: `<credentialId>.<secret>`. */
export const getDeviceCredential = async (): Promise<string | null> => {
  try {
    const [id, secret] = await Promise.all([
      SecureStore.getItemAsync(CREDENTIAL_ID_KEY),
      SecureStore.getItemAsync(CREDENTIAL_SECRET_KEY),
    ]);

    return id && secret ? `${id}.${secret}` : null;
  } catch (error) {
    console.error(
      "Could not read device credential:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
};

export const hasDeviceCredential = async (): Promise<boolean> =>
  (await getDeviceCredential()) !== null;

/**
 * Create and persist a credential, returning what the server needs to store.
 * The secret itself never leaves the device again after registration.
 */
const createLocalCredential = async (): Promise<{
  credentialId: string;
  secretHash: string;
}> => {
  const credentialId = generateSecureUUID();
  const secret = toHex(generateSecureBytes(SECRET_BYTES));

  const secretHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    secret
  );

  await SecureStore.setItemAsync(CREDENTIAL_ID_KEY, credentialId);
  await SecureStore.setItemAsync(CREDENTIAL_SECRET_KEY, secret);

  return { credentialId, secretHash };
};

/**
 * Register a credential for this install, proving identity with the Auth0
 * access token the user holds at that moment. Called once, right after account
 * creation, while connectivity is good - never on the emergency path.
 *
 * Returns true if the device now holds a usable credential.
 */
export const registerDeviceCredential = async (
  accessToken: string
): Promise<boolean> => {
  if (await hasDeviceCredential()) return true;

  const endpoint = process.env.EXPO_PUBLIC_ALERT_URL;
  if (!endpoint) {
    console.error("Alert credential registration URL is not configured");
    return false;
  }

  try {
    const { credentialId, secretHash } = await createLocalCredential();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: "register", credentialId, secretHash }),
    });

    if (!response.ok) {
      // Do not keep a local credential the server does not know about; it
      // would fail at the worst possible moment and look like a lost alert.
      await clearDeviceCredential();
      console.error(
        `Alert credential registration failed with status ${response.status}`
      );
      return false;
    }

    return true;
  } catch (error) {
    await clearDeviceCredential();
    console.error(
      "Alert credential registration failed:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
};

/**
 * Make sure this install has a usable credential, registering one if not.
 *
 * Registration at sign-up can fail - no connectivity, a transient error - and
 * without this the user would hold no credential and every future alert would
 * fail. Called on app start and when the alert screen mounts, so the gap heals
 * long before it matters. Cheap and idempotent: a no-op once a credential
 * exists, and never runs on the emergency path itself.
 *
 * Gets its access token from getFreshAccessToken(), not a cached one - this
 * is what makes the healing actually work weeks after sign-up rather than
 * only within the original access token's lifetime. If the refresh token
 * itself is gone (expired, revoked, never logged in), that call returns null
 * and this reports the same "cannot heal right now" false it always could.
 */
export const ensureDeviceCredential = async (): Promise<boolean> => {
  if (await hasDeviceCredential()) return true;

  try {
    const accessToken = await getFreshAccessToken();
    if (!accessToken) return false;
    return await registerDeviceCredential(accessToken);
  } catch (error) {
    console.error(
      "Could not ensure device credential:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
};

export const clearDeviceCredential = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(CREDENTIAL_ID_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(CREDENTIAL_SECRET_KEY).catch(() => undefined),
  ]);
};

export default {
  getDeviceCredential,
  hasDeviceCredential,
  registerDeviceCredential,
  ensureDeviceCredential,
  clearDeviceCredential,
};
