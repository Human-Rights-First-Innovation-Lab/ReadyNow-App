import {
  encryptData,
  decryptData,
  getEncryptionKey,
  isAeadCiphertext,
  authenticateWithDeviceLock,
  wipeSensitiveData,
} from "../encryption-utils";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { encode as b64encode, decode as b64decode } from "base-64";

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-local-authentication
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  SecurityLevel: {
    NONE: 0,
    SECRET: 1,
    BIOMETRIC_WEAK: 2,
    BIOMETRIC_STRONG: 3,
  },
}));

// Real randomness - nonce uniqueness is a correctness property worth exercising
jest.mock("../secureRandom", () => ({
  generateSecureBytes: (length: number) =>
    new Uint8Array(jest.requireActual("crypto").randomBytes(length)),
}));

const AEAD_KEY_NAME = "emergency_plan_encryption_key_aead";
const LEGACY_KEY_NAME = "emergency_plan_encryption_key";

// A valid stored AEAD key: 32 bytes, base64-encoded
const makeStoredKey = (fill = 7): string => {
  const bytes = new Uint8Array(32).fill(fill);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return b64encode(binary);
};

/**
 * Faithful reproduction of the retired repeating-key XOR implementation.
 * Used to prove that data written by the old app is still readable, so existing
 * installs are migrated rather than orphaned.
 */
const legacyXorEncrypt = (text: string, key: string): string => {
  const utf8ToBinaryString = (str: string): string => {
    const arr = new TextEncoder().encode(str);
    let out = "";
    for (let i = 0; i < arr.length; i++) out += String.fromCharCode(arr[i]);
    return out;
  };

  const binaryText = utf8ToBinaryString(text);
  const result: number[] = [];
  for (let i = 0; i < binaryText.length; i++) {
    result.push(binaryText.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return b64encode(utf8ToBinaryString(String.fromCharCode(...result)));
};

describe("Encryption Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getEncryptionKey", () => {
    it("returns the existing key as 32 bytes", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(makeStoredKey());

      const key = await getEncryptionKey();

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key).toHaveLength(32);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(AEAD_KEY_NAME);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it("generates and stores a new key when none exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      const key = await getEncryptionKey();

      expect(key).toHaveLength(32);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        AEAD_KEY_NAME,
        expect.any(String)
      );
    });

    it("generates a different key on each fresh install", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      const first = await getEncryptionKey();
      const second = await getEncryptionKey();

      expect(Array.from(first)).not.toEqual(Array.from(second));
    });

    it("throws rather than silently replacing a malformed key", async () => {
      // Regenerating here would make every existing record undecryptable
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(b64encode("short"));

      await expect(getEncryptionKey()).rejects.toThrow(/malformed/i);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("encryptData and decryptData", () => {
    beforeEach(() => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(makeStoredKey());
    });

    const roundTrips: [string, string][] = [
      ["simple text", "Hello, World!"],
      ["empty string", ""],
      ["very short string", "A"],
      ["only spaces", "     "],
      ["unicode characters", "Hello 世界 🌍 émojis"],
      ["special characters", "!@#$%^&*()_+-=[]{}|;:,.<>?/~`"],
      ["multilingual text", "English, 한국어, Español, 中文, العربية"],
      ["newlines and tabs", "Line 1\nLine 2\tTabbed"],
      ["null bytes", "Before\x00After"],
      ["long text", "A".repeat(10000)],
    ];

    it.each(roundTrips)("round-trips %s", async (_label, originalText) => {
      const encrypted = await encryptData(originalText);
      expect(await decryptData(encrypted)).toBe(originalText);
    });

    it("round-trips a realistic emergency plan payload", async () => {
      const originalData = JSON.stringify({
        user: {
          name: "John Doe",
          contacts: [
            { id: "1", name: "Contact 1", phone: "+1234567890" },
            { id: "2", name: "Contact 2", phone: "+0987654321" },
          ],
        },
        messages: [
          {
            id: "msg-1",
            topic: "Legal Support",
            text: "Emergency message with émojis 🚨",
            timestamp: "2023-01-01T00:00:00Z",
          },
        ],
        settings: { language: "en", notifications: true },
      });

      const decrypted = await decryptData(await encryptData(originalData));
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(originalData));
    });

    it("does not leak the plaintext into the ciphertext", async () => {
      const originalText = "Secret message";

      const encrypted = await encryptData(originalText);

      expect(encrypted).not.toBe(originalText);
      expect(encrypted).not.toContain(originalText);
    });

    it("produces a fresh nonce per record, so identical input encrypts differently", async () => {
      const originalText = "Test message";

      const first = await encryptData(originalText);
      const second = await encryptData(originalText);

      expect(first).not.toBe(second);
      expect(await decryptData(first)).toBe(originalText);
      expect(await decryptData(second)).toBe(originalText);
    });

    it("marks its output as AEAD ciphertext", async () => {
      expect(isAeadCiphertext(await encryptData("anything"))).toBe(true);
      expect(isAeadCiphertext("cmFuZG9tIGxlZ2FjeSBibG9i")).toBe(false);
    });

    it("rejects a record whose ciphertext was tampered with", async () => {
      // This is the property the retired XOR implementation lacked: an attacker
      // with write access to the store could alter a contact number undetected.
      const encrypted = await encryptData("Attorney phone: +15551234567");

      const prefix = encrypted.slice(0, 4);
      const raw = b64decode(encrypted.slice(4));

      // Flip one bit in the ciphertext body, past the 24-byte nonce
      const target = 30;
      const flipped =
        raw.slice(0, target) +
        String.fromCharCode(raw.charCodeAt(target) ^ 0x01) +
        raw.slice(target + 1);

      await expect(decryptData(prefix + b64encode(flipped))).rejects.toThrow(
        /invalid tag/i
      );
    });

    it("rejects a record whose nonce was tampered with", async () => {
      const encrypted = await encryptData("some plan data");

      const prefix = encrypted.slice(0, 4);
      const raw = b64decode(encrypted.slice(4));
      const flipped =
        String.fromCharCode(raw.charCodeAt(0) ^ 0x01) + raw.slice(1);

      await expect(decryptData(prefix + b64encode(flipped))).rejects.toThrow();
    });

    it("rejects a truncated record", async () => {
      const encrypted = await encryptData("some plan data");
      const truncated = encrypted.slice(0, 8);

      await expect(decryptData(truncated)).rejects.toThrow();
    });

    it("cannot decrypt a record written under a different key", async () => {
      const encrypted = await encryptData("Test message");

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(makeStoredKey(9));

      await expect(decryptData(encrypted)).rejects.toThrow();
    });
  });

  describe("legacy XOR migration path", () => {
    const legacyKey =
      "9f2c4a1e7b3d8f5a0c6e2b9d4f7a1c3e5b8d0f2a4c6e8b1d3f5a7c9e0b2d4f6a";

    it("reads a record written by the retired XOR implementation", async () => {
      const plaintext = JSON.stringify({
        "2125550143": { messages: [{ topic: "Legal Support", message: "Help" }] },
      });
      const legacyRecord = legacyXorEncrypt(plaintext, legacyKey);

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === LEGACY_KEY_NAME ? legacyKey : null)
      );

      expect(await decryptData(legacyRecord)).toBe(plaintext);
    });

    it("reads a legacy record containing multibyte characters", async () => {
      const plaintext = "한국어 계획 🌍 émoji";
      const legacyRecord = legacyXorEncrypt(plaintext, legacyKey);

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === LEGACY_KEY_NAME ? legacyKey : null)
      );

      expect(await decryptData(legacyRecord)).toBe(plaintext);
    });

    it("throws when the legacy key is gone", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      await expect(decryptData("bGVnYWN5IGJsb2I=")).rejects.toThrow(
        /legacy encryption key is missing/i
      );
    });
  });

  describe("authenticateWithDeviceLock", () => {
    const PROMPT = {
      promptMessage: "Authenticate to access your emergency plan",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    };

    it("prompts on a PIN-only device with no biometrics enrolled", async () => {
      // The regression this whole change exists for. Previously
      // hasHardwareAsync() === false returned true without asking for
      // anything, leaving the plan readable on any older handset.
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.SECRET
      );
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await authenticateWithDeviceLock();

      expect(result).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(PROMPT);
    });

    it("denies access when the PIN prompt is dismissed", async () => {
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.SECRET
      );
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: false,
      });

      expect(await authenticateWithDeviceLock()).toBe(false);
    });

    it.each([
      ["BIOMETRIC_WEAK", LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK],
      ["BIOMETRIC_STRONG", LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG],
    ])("prompts at security level %s", async (_label, level) => {
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        level
      );
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });

      expect(await authenticateWithDeviceLock()).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(PROMPT);
    });

    it("allows access only when the device has no lock screen at all", async () => {
      // The single remaining fail-open. There is no credential to check
      // against, and anyone holding the phone already has everything on it.
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.NONE
      );

      const result = await authenticateWithDeviceLock();

      expect(result).toBe(true);
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
      // Logged rather than silent, so it is visible in a crash report.
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("does not gate on biometric hardware being present", async () => {
      // hasHardwareAsync is no longer consulted; a device can lack a sensor
      // and still have a credential worth checking.
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.SECRET
      );
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });

      await authenticateWithDeviceLock();

      expect(LocalAuthentication.hasHardwareAsync).not.toHaveBeenCalled();
      expect(LocalAuthentication.isEnrolledAsync).not.toHaveBeenCalled();
    });

    it("denies access when the enrolment check throws", async () => {
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockRejectedValue(
        new Error("LocalAuthentication unavailable")
      );

      expect(await authenticateWithDeviceLock()).toBe(false);
    });

    it("denies access when authentication throws", async () => {
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.SECRET
      );
      (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValue(
        new Error("Authentication error")
      );

      expect(await authenticateWithDeviceLock()).toBe(false);
    });
  });

  describe("wipeSensitiveData", () => {
    it("deletes both the current and retired encryption keys", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await wipeSensitiveData();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AEAD_KEY_NAME);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(LEGACY_KEY_NAME);
    });

    it("deletes all sensitive data keys", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await wipeSensitiveData();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_plan_data");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_plan_completed");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("has_legal_support");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("selected_additional_topics");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("additionalLegalHelp");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_data_format_version");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("user_phone_number");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("demo_modal_shown");
    });

    it("deletes chunked data when chunks exist", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_chunk_count") return Promise.resolve("3");
        return Promise.resolve(null);
      });
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await wipeSensitiveData();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_data_chunk_0");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_data_chunk_1");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_data_chunk_2");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("emergency_data_chunk_count");
    });

    it("handles deletion errors by throwing", async () => {
      const deleteError = new Error("Delete failed");
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(deleteError);

      try {
        await wipeSensitiveData();
        throw new Error("Expected wipeSensitiveData to throw an error");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        expect(errorMessage).toContain(
          "Error wiping sensitive data: Critical deletion(s) failed"
        );
        expect(errorMessage).toContain("emergency_plan_encryption_key");
        expect(errorMessage).toContain("emergency_plan_data");
      }
    });

    it("deletes large number of chunks", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "emergency_data_chunk_count") return Promise.resolve("10");
        return Promise.resolve(null);
      });
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await wipeSensitiveData();

      for (let i = 0; i < 10; i++) {
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
          `emergency_data_chunk_${i}`
        );
      }
    });
  });
});
