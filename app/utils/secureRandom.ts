import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

/**
 * Secure random utilities for cryptographically secure operations
 * Never use Math.random() for security-sensitive operations!
 */

/**
 * Generates a cryptographically secure random token
 * @param length Number of bytes for the token (default: 32)
 * @returns Hex-encoded secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Generates a cryptographically secure password
 * @param length Length of the password (default: 12)
 * @returns Secure random password
 */
export const generateSecurePassword = (length: number = 12): string => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array, byte => charset[byte % charset.length]).join("");
};

/**
 * Generates a cryptographically secure numeric code
 * @param length Length of the code (default: 6)
 * @returns Secure random numeric code
 */
export const generateSecureNumericCode = (length: number = 6): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array, byte => (byte % 10).toString()).join("");
};

/**
 * Generates a cryptographically secure UUID v4
 * @returns Secure random UUID
 */
export const generateSecureUUID = (): string => {
  return uuidv4(); // Uses secure random under the hood
};

/**
 * Generates a secure random integer within a range
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Secure random integer
 */
export const generateSecureRandomInt = (min: number, max: number): number => {
  if (min >= max) {
    throw new Error("min must be less than max");
  }
  
  const range = max - min + 1;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  
  return min + (array[0] % range);
};

/**
 * Generates secure random bytes for encryption key material
 * @param length Number of bytes to generate
 * @returns Uint8Array of secure random bytes
 */
export const generateSecureBytes = (length: number): Uint8Array => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
};

/**
 * Generates a secure random string for encryption key generation
 * This is specifically for use with crypto.digestStringAsync()
 * @param length Length of entropy in bytes (default: 32)
 * @returns Base64-encoded secure random string suitable for key derivation
 */
export const generateSecureEntropyString = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  // Convert to base64 for use with digestStringAsync
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  
  // Add timestamp for additional entropy (but secure random is the primary source)
  const timestamp = Date.now().toString();
  const platform = typeof navigator !== "undefined" ? navigator.platform : "unknown";
  
  return btoa(binary) + "-" + timestamp + "-" + platform;
};

/**
 * DEPRECATED: Use generateSecureEntropyString instead
 * @deprecated This function name might be confused with insecure Math.random
 */
export const generateCryptoRandom = generateSecureEntropyString; 