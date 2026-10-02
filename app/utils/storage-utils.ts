import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from "react-native";
import { transformToNewFormat, transformToOldFormat } from "./emergency-plan-utils";
import type { EmergencyPlanData } from "./emergency-plan-utils";
import type { MessageData } from "../components/MessageSetup";
import { encryptData, decryptData, isAeadCiphertext, wipeSensitiveData } from "./encryption-utils";

// Key for storing user data
export const USER_DATA_KEY = "user_data";

// Debug helper function to show alerts in production
const debugAlert = (title: string, message: string) => {
  Alert.alert(
    `DEBUG: ${title}`,
    message,
    [{ text: "OK" }]
  );
};

// Load sample data into SecureStore
export const loadSampleData = async (sampleData: unknown): Promise<boolean> => {
  try {
    const jsonString = JSON.stringify(sampleData);
    await SecureStore.setItemAsync(USER_DATA_KEY, jsonString);
    return true;
  } catch (error) {
    console.error("Error loading sample data:", 
      error instanceof Error ? error.message : String(error));
    return false;
  }
};

// Get user data from SecureStore
export const getUserData = async (): Promise<unknown> => {
  try {
    const data = await SecureStore.getItemAsync(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error getting user data:", 
      error instanceof Error ? error.message : String(error));
    return null;
  }
};

// Get data for a specific phone number
export const getUserDataByPhone = async (phoneNumber: string): Promise<unknown> => {
  try {
    const userData = await getUserData();
    if (!userData) return null;
    return (userData as Record<string, unknown>)[phoneNumber] ?? null;
  } catch (error) {
    // The phone number is deliberately not logged - console output can be
    // captured as breadcrumbs and it identifies the user.
    console.error("Error retrieving user data by phone:", error);
    return null;
  }
};

// Update user data
export const updateUserData = async (phoneNumber: string, newData: unknown): Promise<boolean> => {
  try {
    const userData = (await getUserData() || {}) as Record<string, unknown>;
    userData[phoneNumber] = newData;
    await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData));
    return true;
  } catch (error) {
    console.error("Error updating user data:", error);
    return false;
  }
};

// Clear all user data
export const clearUserData = async (): Promise<boolean> => {
  try {
    await SecureStore.deleteItemAsync(USER_DATA_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing user data:", error);
    return false;
  }
};

export const clearAdditionalLegalHelp = async (): Promise<boolean> => {
  try {
    await SecureStore.deleteItemAsync("additionalLegalHelp");
    return true;
  } catch (error) {
    console.error("Error clearing additional legal help data :", error);
    return false;
  }
};


const EMERGENCY_DATA_KEY = "emergency_plan_data";
const EMERGENCY_DATA_CHUNK_PREFIX = "emergency_data_chunk_";
const EMERGENCY_DATA_CHUNK_COUNT = "emergency_data_chunk_count";
const USER_PHONE_KEY = "user_phone_number";

/**
 * Partition key used when the user has not given us a phone number yet.
 *
 * Emergency plan records are keyed by phone number. Before this constant
 * existed the code substituted a hardcoded real, dialable NYC number
 * belonging to someone with no connection to this app, and wrote it to
 * USER_PHONE_KEY as though the user had entered it. AlertButton reads that
 * same key and passes it to sendIntakeToNilra, so the placeholder could be
 * transmitted to the legal intake API as the user's contact number: a
 * stranger's number attached to somebody else's immigration emergency, and a
 * responder left with no way to call the person who actually needs help.
 *
 * This is a storage partition key and nothing else. It is deliberately not a
 * valid phone number so it can never be dialled, sent onward, or mistaken for
 * one, and it is never written to USER_PHONE_KEY.
 */
export const UNASSIGNED_PLAN_KEY = "__unassigned__";
const DATA_FORMAT_VERSION_KEY = "emergency_data_format_version";

/**
 * Emergency plan storage format versions.
 *
 *   1 (absent) - legacy plain JSON, unversioned
 *   2          - single-record XOR ciphertext        (read-only, migrated on load)
 *   3          - UNENCRYPTED fallback, now retired   (read-only, migrated on load)
 *   4          - chunked XOR ciphertext              (read-only, migrated on load)
 *   5          - chunked XChaCha20-Poly1305 (AEAD)   <- current, the only format written
 *
 * Versions 2-4 are read so existing installs keep their data, but nothing writes
 * them any more. Anything loaded in an older format is re-saved as version 5.
 */
const FORMAT_AEAD = "5";
const FORMAT_XOR_CHUNKED = "4";
const FORMAT_PLAINTEXT_RETIRED = "3";
const FORMAT_XOR_SINGLE = "2";

// Maximum size per chunk (2000 bytes is safe, leaving room for overhead)
const MAX_CHUNK_SIZE = 1800;

// Helper function to split a string into chunks of specified size
const chunkString = (str: string, size: number): string[] => {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size));
  }
  return chunks;
};

// Remove any chunk records left over from a previous save
const clearExistingChunks = async (): Promise<void> => {
  const chunkCountStr = await SecureStore.getItemAsync(EMERGENCY_DATA_CHUNK_COUNT);
  if (!chunkCountStr) return;

  const chunkCount = parseInt(chunkCountStr, 10);
  if (isNaN(chunkCount)) return;

  for (let i = 0; i < chunkCount; i++) {
    await SecureStore.deleteItemAsync(`${EMERGENCY_DATA_CHUNK_PREFIX}${i}`);
  }
  await SecureStore.deleteItemAsync(EMERGENCY_DATA_CHUNK_COUNT);
};

/**
 * Persist an already-encrypted record, chunking it if it exceeds SecureStore's
 * practical per-item limit.
 *
 * The format version is written last, on purpose: if any write fails partway
 * through, the stored version tag still describes whatever was there before
 * rather than advertising a record that was never completed.
 */
const writeEmergencyRecord = async (encryptedData: string): Promise<void> => {
  await clearExistingChunks();

  if (encryptedData.length > MAX_CHUNK_SIZE) {
    await SecureStore.deleteItemAsync(EMERGENCY_DATA_KEY);

    const chunks = chunkString(encryptedData, MAX_CHUNK_SIZE);
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${EMERGENCY_DATA_CHUNK_PREFIX}${i}`, chunks[i]);
    }
    await SecureStore.setItemAsync(EMERGENCY_DATA_CHUNK_COUNT, chunks.length.toString());
  } else {
    await SecureStore.setItemAsync(EMERGENCY_DATA_KEY, encryptedData);
  }

  await SecureStore.setItemAsync(DATA_FORMAT_VERSION_KEY, FORMAT_AEAD);
};

// Save emergency plan data in the new format
export const saveEmergencyPlanData = async (
  data: { messages: MessageData[] } | MessageData[],
  userPhoneNumber?: string
): Promise<void> => {
  // Declare this outside try/catch so it's accessible in the catch block
  let newFormatData: EmergencyPlanData = {};
  
  try {
    // Get user's phone number
    let phoneNumber = userPhoneNumber;
    if (!phoneNumber) {
      const storedPhoneNumber = await SecureStore.getItemAsync(USER_PHONE_KEY);
      phoneNumber = storedPhoneNumber ?? undefined;
    }
    
    // Still no phone number: partition the record under a sentinel rather
    // than inventing one. Nothing is written to USER_PHONE_KEY, so the alert
    // path continues to report "no phone number" instead of a fabricated one.
    if (!phoneNumber) {
      phoneNumber = UNASSIGNED_PLAN_KEY;
    }
    
    // Handle both object with messages property and direct array of messages
    let messages: MessageData[];
    if (Array.isArray(data)) {
      messages = data;
    } else {
      messages = Array.isArray(data.messages) ? data.messages : [];
    }
    
    // Transform to new format
    const oldFormatData = { messages };
    newFormatData = transformToNewFormat(oldFormatData, phoneNumber);
    
    const jsonData = JSON.stringify(newFormatData);

    // Encrypt first. If this throws, nothing is written and the error propagates
    // to the caller. There is deliberately no unencrypted fallback: emergency
    // plans contain A-numbers, dates of birth and contact details, and silently
    // downgrading them to plaintext is worse than failing the save outright.
    const encryptedData = await encryptData(jsonData);

    await writeEmergencyRecord(encryptedData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dataSize = JSON.stringify(newFormatData).length;
    const debugInfo = `
Platform: ${Platform.OS}
Version: ${Platform.Version}
Production: ${!__DEV__}
Data size: ${dataSize} bytes
Error: ${errorMessage}
    `;

    console.error(
      "Error saving emergency plan data:",
      errorMessage,
      error instanceof Error ? error.stack : "No stack trace"
    );
    
    // Development only - this dialog exposes build details and is not something
    // users should ever see in a shipped build.
    if (__DEV__) {
      debugAlert("Save Error", debugInfo);
    }

    throw error;
  }
};

// Load emergency plan data, handling both old and new formats
/**
 * Read the stored record, reassembling chunks when present.
 *
 * Returns null if any chunk is missing. The previous implementation skipped
 * absent chunks and joined what remained, which produced a silently truncated
 * payload; with authenticated encryption that would surface as a confusing
 * decrypt failure, so an incomplete record is now reported as absent.
 */
const readEmergencyRecord = async (): Promise<string | null> => {
  const chunkCountStr = await SecureStore.getItemAsync(EMERGENCY_DATA_CHUNK_COUNT);

  if (chunkCountStr) {
    const chunkCount = parseInt(chunkCountStr, 10);
    if (isNaN(chunkCount) || chunkCount <= 0) return null;

    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${EMERGENCY_DATA_CHUNK_PREFIX}${i}`);
      if (chunk === null) {
        console.error(
          `Missing chunk ${i} of ${chunkCount} - stored emergency plan is incomplete`
        );
        return null;
      }
      chunks.push(chunk);
    }
    return chunks.join("");
  }

  return await SecureStore.getItemAsync(EMERGENCY_DATA_KEY);
};

/**
 * Normalize topic names and, when needed, rewrite the record.
 *
 * `needsUpgrade` is set when the data was read from a retired format (XOR
 * ciphertext or the old unencrypted fallback). Re-saving routes through
 * saveEmergencyPlanData, so the record comes back as encrypted format 5.
 */
const finalizeLoadedMessages = async (
  messages: MessageData[],
  needsUpgrade: boolean
): Promise<{ messages: MessageData[] }> => {
  if (!messages || messages.length === 0) {
    return { messages: messages || [] };
  }

  const normalizedMessages = messages.map((message) => {
    const updatedMessage = { ...message };

    // Handle Legal Support translations
    if (
      message.topic.includes("법적지원") || // Korean
      message.topic.includes("Apoyo Legal") || // Spanish
      (message.topic.toLowerCase().includes("legal") &&
        message.topic !== "Legal Support")
    ) {
      updatedMessage.topic = "Legal Support";
    }

    return updatedMessage;
  });

  const topicsChanged =
    JSON.stringify(messages) !== JSON.stringify(normalizedMessages);

  if (topicsChanged || needsUpgrade) {
    await saveEmergencyPlanData(normalizedMessages).catch((err) => {
      console.error("Error re-saving emergency plan data after load:", err);
    });
  }

  return { messages: normalizedMessages };
};

// Load emergency plan data, reading retired formats so existing installs keep
// their data. Anything not already in format 5 is re-encrypted on load.
export const loadEmergencyPlanData = async (): Promise<{ messages: MessageData[] }> => {
  try {
    const formatVersion = await SecureStore.getItemAsync(DATA_FORMAT_VERSION_KEY);
    const storedRecord = await readEmergencyRecord();

    if (!storedRecord) return { messages: [] };

    let newFormatData: EmergencyPlanData;
    let needsUpgrade = false;

    if (formatVersion === FORMAT_PLAINTEXT_RETIRED) {
      // Retired unencrypted fallback. Read it so the user does not lose their
      // plan, then re-save so it is stored encrypted.
      newFormatData = JSON.parse(storedRecord) as EmergencyPlanData;
      needsUpgrade = true;
    } else if (
      formatVersion === FORMAT_AEAD ||
      formatVersion === FORMAT_XOR_CHUNKED ||
      formatVersion === FORMAT_XOR_SINGLE
    ) {
      // decryptData distinguishes AEAD from legacy XOR by inspecting the record
      const decryptedData = await decryptData(storedRecord);
      newFormatData = JSON.parse(decryptedData) as EmergencyPlanData;
      needsUpgrade = !isAeadCiphertext(storedRecord);
    } else {
      // Unversioned legacy data: plain JSON in the pre-phone-keyed shape
      const oldFormatData = JSON.parse(storedRecord) as { messages: MessageData[] };
      return await finalizeLoadedMessages(oldFormatData.messages ?? [], true);
    }

    const phoneNumber =
      (await SecureStore.getItemAsync(USER_PHONE_KEY)) ??
      Object.keys(newFormatData)[0];

    if (!phoneNumber || !newFormatData[phoneNumber]) {
      return { messages: [] };
    }

    const oldFormatData = transformToOldFormat(newFormatData, phoneNumber);
    return await finalizeLoadedMessages(oldFormatData.messages, needsUpgrade);
  } catch (error) {
    console.error(
      "Error loading emergency plan data:",
      error instanceof Error ? error.message : String(error)
    );
    return { messages: [] };
  }
};

/**
 * Migrate unversioned legacy data (plain JSON, pre-phone-keyed shape) into the
 * current encrypted format.
 *
 * Records already carrying a known version tag are left alone here:
 * loadEmergencyPlanData reads the retired formats and re-encrypts them as it
 * goes, so there is no need to duplicate that logic.
 */
export const migrateToNewFormat = async (): Promise<void> => {
  try {
    const formatVersion = await SecureStore.getItemAsync(DATA_FORMAT_VERSION_KEY);

    if (
      formatVersion === FORMAT_AEAD ||
      formatVersion === FORMAT_XOR_CHUNKED ||
      formatVersion === FORMAT_PLAINTEXT_RETIRED ||
      formatVersion === FORMAT_XOR_SINGLE
    ) {
      return;
    }

    const storedData = await SecureStore.getItemAsync(EMERGENCY_DATA_KEY);
    if (!storedData) {
      // Nothing to migrate. Record the current version so this does not re-run.
      await SecureStore.setItemAsync(DATA_FORMAT_VERSION_KEY, FORMAT_AEAD);
      return;
    }

    let oldData: { messages: MessageData[] };
    try {
      oldData = JSON.parse(storedData) as { messages: MessageData[] };
    } catch (parseError) {
      // The stored blob is not readable as legacy JSON. Leave it untouched
      // rather than overwriting it, and do not claim a format version that
      // would not describe what is actually stored.
      console.error(
        "Error parsing old data format:",
        parseError instanceof Error ? parseError.message : String(parseError)
      );
      throw new Error(
        `JSON Parse error: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
    }

    // Partition the migrated record under the real number if we have one, and
    // under the sentinel otherwise. As above, nothing is invented or stored.
    const storedPhoneNumber = await SecureStore.getItemAsync(USER_PHONE_KEY);
    const phoneNumber = storedPhoneNumber || UNASSIGNED_PLAN_KEY;

    const newFormatData = transformToNewFormat(oldData, phoneNumber);
    const jsonData = JSON.stringify(newFormatData);

    // Encrypt or fail. Migration must never leave plan data in the clear.
    const encryptedData = await encryptData(jsonData);
    await writeEmergencyRecord(encryptedData);
  } catch (error) {
    console.error(
      "Error migrating data:",
      error instanceof Error ? error.message : String(error)
    );

    // Don't block app operation; loadEmergencyPlanData degrades to an empty plan
    console.error("Migration failed but continuing app operation");
  }
};

// Enhanced reset function that uses the new wipe functionality
export const resetEmergencyPlanData = async (): Promise<void> => {
  try {
    await wipeSensitiveData();
  } catch (error) {
    console.error(
      "Error resetting emergency plan data:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};

export const migrateTopicNames = async (): Promise<void> => {
  try {
    const { messages } = await loadEmergencyPlanData();
    
    // Check if migration is needed
    const needsMigration = messages.some(msg => 
      (msg.topic.includes("법적지원") || // Korean legal support
       msg.topic.includes("Apoyo Legal") || // Spanish legal support
       (msg.topic.toLowerCase().includes("legal") && msg.topic !== "Legal Support"))
    );
    
    if (!needsMigration) {
      return;
    }
        
    // Normalize topic names
    const updatedMessages = messages.map(message => {
      let updatedMessage = { ...message };
      
      // Handle Legal Support translations
      if (message.topic.includes("법적지원") || // Korean
          message.topic.includes("Apoyo Legal") || // Spanish  
          message.topic.toLowerCase().includes("legal")) {
        updatedMessage.topic = "Legal Support";
      }
      
      return updatedMessage;
    });
    
    // Save the updated messages
    if (JSON.stringify(messages) !== JSON.stringify(updatedMessages)) {
      await saveEmergencyPlanData(updatedMessages);
    } 
  } catch (error) {
    console.error(
      "Error in topic name migration:",
      error instanceof Error ? error.message : String(error)
    );
    // Don't throw error to prevent app from crashing
  }
};

export default {
  saveEmergencyPlanData,
  loadEmergencyPlanData,
  migrateToNewFormat,
  resetEmergencyPlanData,
  migrateTopicNames,
};