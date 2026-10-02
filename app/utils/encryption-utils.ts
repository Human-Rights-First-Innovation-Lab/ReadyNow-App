import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { encode as b64encode, decode as b64decode } from "base-64";
import { generateSecureBytes } from "./secureRandom";

/**
 * Emergency plan data is encrypted with XChaCha20-Poly1305 (AEAD) before being
 * written to SecureStore.
 *
 * Design notes:
 *  - AEAD gives us both confidentiality and integrity. A tampered record fails
 *    to decrypt instead of silently yielding altered contact details.
 *  - A fresh 24-byte random nonce is generated per record. XChaCha20's extended
 *    nonce makes random nonces safe without any counter bookkeeping.
 *  - Ciphertext is self-describing (see AEAD_PREFIX), so decryptData can detect
 *    and read records written by the previous XOR implementation and callers can
 *    transparently re-encrypt them.
 */

// Key storage - configurable per environment.
// The legacy name holds the old XOR key and is retained read-only so existing
// installs can still be migrated. New key material lives under its own name so
// the two can never be confused.
const LEGACY_ENCRYPTION_KEY =
  process.env.EXPO_PUBLIC_ENCRYPTION_KEY_NAME || "emergency_plan_encryption_key";
const AEAD_ENCRYPTION_KEY = `${LEGACY_ENCRYPTION_KEY}_aead`;

// Envelope marker for XChaCha20-Poly1305 records: AEAD_PREFIX + base64(nonce || ciphertext || tag)
const AEAD_PREFIX = "RN1.";

const KEY_BYTES = 32;
const NONCE_BYTES = 24;
const TAG_BYTES = 16;

// Byte/binary-string conversions.
// These deliberately avoid String.fromCharCode(...array) — spreading a large
// array overflows the call stack, which previously broke encryption for users
// with big emergency plans and silently pushed them onto the plaintext path.
const bytesToBinaryString = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
};

const binaryStringToBytes = (binary: string): Uint8Array => {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
};

const utf8Decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const bytesToBase64 = (bytes: Uint8Array): string =>
  b64encode(bytesToBinaryString(bytes));

const base64ToBytes = (input: string): Uint8Array =>
  binaryStringToBytes(b64decode(input));

/** True when the value was written by the current AEAD implementation. */
export const isAeadCiphertext = (value: string): boolean =>
  typeof value === "string" && value.startsWith(AEAD_PREFIX);

/**
 * Get or create the AEAD encryption key (32 random bytes, stored base64).
 *
 * A malformed stored key throws rather than regenerating: silently replacing it
 * would render every existing record permanently undecryptable.
 */
export const getEncryptionKey = async (): Promise<Uint8Array> => {
  const stored = await SecureStore.getItemAsync(AEAD_ENCRYPTION_KEY);

  if (stored) {
    const key = base64ToBytes(stored);
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `Stored encryption key is malformed (expected ${KEY_BYTES} bytes, got ${key.length})`
      );
    }
    return key;
  }

  const key = generateSecureBytes(KEY_BYTES);
  await SecureStore.setItemAsync(AEAD_ENCRYPTION_KEY, bytesToBase64(key));
  return key;
};

/** Encrypt a UTF-8 string with XChaCha20-Poly1305. */
export const encryptData = async (data: string): Promise<string> => {
  const key = await getEncryptionKey();
  const nonce = generateSecureBytes(NONCE_BYTES);

  const plaintext = new TextEncoder().encode(data);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext);

  const envelope = new Uint8Array(nonce.length + ciphertext.length);
  envelope.set(nonce, 0);
  envelope.set(ciphertext, nonce.length);

  return AEAD_PREFIX + bytesToBase64(envelope);
};

/**
 * Seal a payload under a one-off key that is returned alongside the ciphertext
 * and never stored on the device.
 *
 * Used for emergency alerts: the ciphertext can be uploaded while the user is
 * still deciding, and stays unreadable until the key is handed over at the
 * moment they commit. Deliberately does not touch SecureStore - this key must
 * not outlive the alert.
 */
export const sealWithEphemeralKey = async (
  data: string
): Promise<{ ciphertext: string; key: string }> => {
  const key = generateSecureBytes(KEY_BYTES);
  const nonce = generateSecureBytes(NONCE_BYTES);

  const sealed = xchacha20poly1305(key, nonce).encrypt(
    new TextEncoder().encode(data)
  );

  const envelope = new Uint8Array(nonce.length + sealed.length);
  envelope.set(nonce, 0);
  envelope.set(sealed, nonce.length);

  return {
    ciphertext: AEAD_PREFIX + bytesToBase64(envelope),
    key: bytesToBase64(key),
  };
};

/**
 * Decrypt data written by encryptData.
 *
 * Records produced by the previous XOR implementation are detected and read via
 * the legacy path so they can be migrated. Throws if the ciphertext has been
 * tampered with or the key is wrong.
 */
export const decryptData = async (encryptedData: string): Promise<string> => {
  if (!isAeadCiphertext(encryptedData)) {
    return decryptLegacyXorData(encryptedData);
  }

  const envelope = base64ToBytes(encryptedData.slice(AEAD_PREFIX.length));
  if (envelope.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error("Encrypted record is too short to be valid");
  }

  const nonce = envelope.subarray(0, NONCE_BYTES);
  const ciphertext = envelope.subarray(NONCE_BYTES);
  const key = await getEncryptionKey();

  // Throws "invalid tag" if the record was modified or the key does not match.
  const plaintext = xchacha20poly1305(key, nonce).decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
};

/**
 * Read a record written by the retired repeating-key XOR implementation.
 *
 * Read-only by design: nothing in the app writes this format any more. Kept so
 * that data belonging to existing installs can be recovered and re-encrypted.
 */
const decryptLegacyXorData = async (encryptedData: string): Promise<string> => {
  const key = await SecureStore.getItemAsync(LEGACY_ENCRYPTION_KEY);
  if (!key) {
    throw new Error("Cannot read legacy record: legacy encryption key is missing");
  }

  // The retired implementation base64-encoded a UTF-8 *re-encoding* of the XOR
  // output, so that layer has to be undone before the XOR can be reversed.
  // Getting this wrong would silently orphan existing users' plans.
  const decoded = utf8Decode(binaryStringToBytes(b64decode(encryptedData)));

  let binary = "";
  for (let i = 0; i < decoded.length; i++) {
    binary += String.fromCharCode(
      decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }

  return utf8Decode(binaryStringToBytes(binary));
};

/**
 * Require the user to prove they are the device owner before a sensitive
 * operation.
 *
 * This used to gate on biometrics alone: no biometric hardware, or no
 * fingerprint or face enrolled, and it returned `true` without asking for
 * anything. Plenty of devices - older Android handsets especially, which our
 * users are more likely to be carrying - have no biometric sensor but do have
 * a PIN, pattern or password. On those, an emergency plan containing an
 * A-number, a date of birth and contact details was reachable by anyone
 * holding the unlocked phone, while the README claimed the opposite.
 *
 * It now gates on whatever lock the device actually has.
 * `getEnrolledLevelAsync` reports `SECRET` for a PIN, pattern or password and
 * a `BIOMETRIC_*` level for fingerprint or face, and `authenticateAsync` with
 * `disableDeviceFallback: false` accepts either - on iOS via
 * `LAPolicy.deviceOwnerAuthentication`, on Android via device credential.
 *
 * The one remaining case that returns `true` without a prompt is a device with
 * no lock screen at all (`NONE`). There is no credential to check against
 * there, and anyone holding that phone already has everything on it. That is a
 * genuine limit rather than a silent pass, so it is logged.
 *
 * (The `getEnrolledLevelAsync` caveat about SIM locks applies only to Android
 * before M; minSdkVersion here is 26.)
 */
export const authenticateWithDeviceLock = async (): Promise<boolean> => {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();

    if (level === LocalAuthentication.SecurityLevel.NONE) {
      console.warn(
        "Device has no lock screen; sensitive operation proceeding unauthenticated"
      );
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access your emergency plan",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });

    return result.success;
  } catch (error) {
    console.error("Error with device authentication:", error);
    return false;
  }
};

// Wipe all sensitive data
// Uses individual try-catch blocks to ensure maximum data deletion even if some operations fail
export const wipeSensitiveData = async (): Promise<void> => {
  const criticalFailedKeys: string[] = [];
  const nonCriticalFailedKeys: string[] = [];
  
  // Helper function to safely delete an item
  // Note: SecureStore.deleteItemAsync typically handles non-existent keys gracefully,
  // so we don't need to check existence first
  const safeDelete = async (key: string, isCritical: boolean = false): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : String(error);
      
      // Log detailed error information for debugging
      // Use console.warn in test environments to reduce noise, but still log errors
      const isTestEnv = process.env.NODE_ENV === "test" || typeof jest !== "undefined";
      
      if (isTestEnv) {
        // In tests, use warn instead of error to reduce CI noise, but still capture the error
        console.warn(`Error deleting ${key}:`, errorMessage);
      } else {
        console.error(`Error deleting ${key}:`, errorMessage, {
          key,
          isCritical,
          errorType: error instanceof Error ? error.constructor.name : "Unknown",
        });
      }
      
      if (isCritical) {
        criticalFailedKeys.push(key);
      } else {
        nonCriticalFailedKeys.push(key);
      }
    }
  };
  
  // Delete encryption keys (current AEAD key and the retired XOR key) - CRITICAL
  await safeDelete(AEAD_ENCRYPTION_KEY, true);
  await safeDelete(LEGACY_ENCRYPTION_KEY, true);
  
  // Delete emergency plan data - CRITICAL
  await safeDelete("emergency_plan_data", true);
  
  // Delete any chunked data
  try {
    const chunkCountStr = await SecureStore.getItemAsync("emergency_data_chunk_count");
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10);
      if (!isNaN(chunkCount) && chunkCount > 0) {
        for (let i = 0; i < chunkCount; i++) {
          await safeDelete(`emergency_data_chunk_${i}`, false);
        }
        await safeDelete("emergency_data_chunk_count", false);
      }
    }
  } catch (error) {
    const readError = error instanceof Error 
      ? error 
      : new Error("Failed to read chunk count");
    console.error("Error reading chunk count:", readError.message);
    // Reading chunk count is non-critical, just log and continue
  }
  
  // Delete other emergency plan related data - NON-CRITICAL
  await safeDelete("emergency_plan_completed", false);
  await safeDelete("has_legal_support", false);
  await safeDelete("selected_additional_topics", false);
  await safeDelete("additionalLegalHelp", false);
  
  // Clear any cached data - NON-CRITICAL
  await safeDelete("emergency_data_format_version", false);
  await safeDelete("user_phone_number", false);
  
  // Clear demo modal shown flag so it shows again after creating new plan - NON-CRITICAL
  await safeDelete("demo_modal_shown", false);
  
  // Delete saved contacts store - NON-CRITICAL
  await safeDelete("saved_contacts_data", false);
  try {
    const savedContactsChunkStr = await SecureStore.getItemAsync("saved_contacts_chunk_count");
    if (savedContactsChunkStr) {
      const chunkCount = parseInt(savedContactsChunkStr, 10);
      if (!isNaN(chunkCount) && chunkCount > 0) {
        for (let i = 0; i < chunkCount; i++) {
          await safeDelete(`saved_contacts_chunk_${i}`, false);
        }
        await safeDelete("saved_contacts_chunk_count", false);
      }
    }
  } catch (error) {
    console.error(
      "Error reading saved contacts chunk count:",
      error instanceof Error ? error.message : String(error)
    );
  }
  
  // If any critical errors occurred, throw an informative error
  // Note: We continue attempting all deletions even if some fail
  if (criticalFailedKeys.length > 0) {
    const errorMessage = `Error wiping sensitive data: Critical deletion(s) failed: ${criticalFailedKeys.join(", ")}`;
    
    // Use console.warn in test environments to reduce CI noise, but still throw
    const isTestEnv = process.env.NODE_ENV === "test" || typeof jest !== "undefined";
    const logMethod = isTestEnv ? console.warn : console.error;
    
    logMethod(errorMessage);
    if (nonCriticalFailedKeys.length > 0) {
      logMethod(`Non-critical deletions also failed: ${nonCriticalFailedKeys.join(", ")}`);
    }
    throw new Error(errorMessage);
  }
  
  // For non-critical errors, log but don't throw (best-effort cleanup)
  if (nonCriticalFailedKeys.length > 0) {
    const isTestEnv = process.env.NODE_ENV === "test" || typeof jest !== "undefined";
    const logMethod = isTestEnv ? console.warn : console.error;
    logMethod(`Non-critical deletions failed (continuing anyway): ${nonCriticalFailedKeys.join(", ")}`);
  }
}; 

export default {
  encryptData,
  decryptData,
  sealWithEphemeralKey,
  isAeadCiphertext,
  authenticateWithDeviceLock,
  wipeSensitiveData,
};
