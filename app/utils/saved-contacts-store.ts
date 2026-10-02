import * as SecureStore from "expo-secure-store";
import { encryptData, decryptData } from "./encryption-utils";

export interface SavedContact {
  id: string;
  name: string;
  phoneNumber: string;
}

const CONTACTS_DATA_KEY = "saved_contacts_data";
const CONTACTS_CHUNK_PREFIX = "saved_contacts_chunk_";
const CONTACTS_CHUNK_COUNT_KEY = "saved_contacts_chunk_count";
const MAX_CHUNK_SIZE = 1800;

const chunkString = (str: string, size: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size));
  }
  return chunks;
};

const normalizePhone = (phone: string): string => phone.replace(/\D/g, "");

const deleteExistingChunks = async (): Promise<void> => {
  const countStr = await SecureStore.getItemAsync(CONTACTS_CHUNK_COUNT_KEY);
  if (!countStr) {
    return;
  }

  const count = parseInt(countStr, 10);
  if (isNaN(count) || count <= 0) {
    return;
  }

  for (let i = 0; i < count; i++) {
    try {
      await SecureStore.deleteItemAsync(`${CONTACTS_CHUNK_PREFIX}${i}`);
    } catch (error) {
      console.error(
        `Error deleting saved contacts chunk ${i}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  try {
    await SecureStore.deleteItemAsync(CONTACTS_CHUNK_COUNT_KEY);
  } catch (error) {
    console.error(
      "Error deleting saved contacts chunk count:",
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * Load all saved contacts from encrypted storage.
 * Returns an empty array if no contacts are stored or decryption fails.
 */
export const loadSavedContacts = async (): Promise<SavedContact[]> => {
  try {
    const countStr = await SecureStore.getItemAsync(CONTACTS_CHUNK_COUNT_KEY);
    let encryptedData: string;

    if (countStr) {
      const count = parseInt(countStr, 10);
      const chunks: string[] = [];

      let missingChunk = false;
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${CONTACTS_CHUNK_PREFIX}${i}`);
        if (chunk === null) {
          console.error(`Missing saved contacts chunk ${i} of ${count}`);
          missingChunk = true;
        } else {
          chunks.push(chunk);
        }
      }
      if (missingChunk) {
        return [];
      }

      encryptedData = chunks.join("");
      if (!encryptedData) {
        return [];
      }
    } else {
      const stored = await SecureStore.getItemAsync(CONTACTS_DATA_KEY);
      if (!stored) {
        return [];
      }
      encryptedData = stored;
    }

    const decrypted = await decryptData(encryptedData);
    return JSON.parse(decrypted) as SavedContact[];
  } catch (error) {
    console.error(
      "Error loading saved contacts:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
};

/**
 * Persist the full contacts array to encrypted storage, using chunking if needed.
 */
export const saveSavedContacts = async (contacts: SavedContact[]): Promise<void> => {
  try {
    const json = JSON.stringify(contacts);
    const encrypted = await encryptData(json);

    await deleteExistingChunks();

    if (encrypted.length > MAX_CHUNK_SIZE) {
      const chunks = chunkString(encrypted, MAX_CHUNK_SIZE);
      await SecureStore.setItemAsync(CONTACTS_CHUNK_COUNT_KEY, chunks.length.toString());

      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${CONTACTS_CHUNK_PREFIX}${i}`, chunks[i]);
      }

      await SecureStore.deleteItemAsync(CONTACTS_DATA_KEY);
    } else {
      await SecureStore.setItemAsync(CONTACTS_DATA_KEY, encrypted);
      await SecureStore.deleteItemAsync(CONTACTS_CHUNK_COUNT_KEY);
    }
  } catch (error) {
    console.error(
      "Error saving contacts:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};

/**
 * Add a contact to the saved list. Skips if a contact with the same
 * normalized phone number already exists. Returns the updated list.
 */
export const addSavedContact = async (contact: SavedContact): Promise<SavedContact[]> => {
  const existing = await loadSavedContacts();
  const normalizedNew = normalizePhone(contact.phoneNumber);

  const isDuplicate = existing.some(
    (c) => normalizePhone(c.phoneNumber) === normalizedNew
  );

  if (isDuplicate) {
    return existing;
  }

  const updated = [...existing, contact];
  await saveSavedContacts(updated);
  return updated;
};

/**
 * Remove a contact by ID. Returns the updated list.
 */
export const removeSavedContact = async (contactId: string): Promise<SavedContact[]> => {
  const existing = await loadSavedContacts();
  const updated = existing.filter((c) => c.id !== contactId);

  await saveSavedContacts(updated);
  return updated;
};

/**
 * Update a contact's name and/or phone number by ID. Returns the updated list.
 */
export const updateSavedContact = async (
  contactId: string,
  updates: Partial<Pick<SavedContact, "name" | "phoneNumber">>
): Promise<SavedContact[]> => {
  const existing = await loadSavedContacts();

  if (updates.phoneNumber) {
    const normalizedNew = normalizePhone(updates.phoneNumber);
    const isDuplicate = existing.some(
      (c) => c.id !== contactId && normalizePhone(c.phoneNumber) === normalizedNew
    );

    if (isDuplicate) {
      return existing;
    }
  }

  const updated = existing.map((c) =>
    c.id === contactId ? { ...c, ...updates } : c
  );

  await saveSavedContacts(updated);
  return updated;
};

/**
 * Delete all saved contacts from storage.
 */
export const clearSavedContacts = async (): Promise<void> => {
  try {
    await deleteExistingChunks();
    await SecureStore.deleteItemAsync(CONTACTS_DATA_KEY);
  } catch (error) {
    console.error(
      "Error clearing saved contacts:",
      error instanceof Error ? error.message : String(error)
    );
  }
};
