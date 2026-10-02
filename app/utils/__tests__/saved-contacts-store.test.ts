import * as SecureStore from "expo-secure-store";
import { encryptData, decryptData } from "../encryption-utils";
import {
  loadSavedContacts,
  saveSavedContacts,
  addSavedContact,
  removeSavedContact,
  updateSavedContact,
  clearSavedContacts,
  SavedContact,
} from "../saved-contacts-store";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("../encryption-utils", () => ({
  encryptData: jest.fn((data: string) => Promise.resolve(`encrypted_${data}`)),
  decryptData: jest.fn((data: string) =>
    Promise.resolve(data.replace("encrypted_", ""))
  ),
}));

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockEncrypt = encryptData as jest.Mock;
const mockDecrypt = decryptData as jest.Mock;

const contact1: SavedContact = {
  id: "c1",
  name: "Alice",
  phoneNumber: "5551112222",
};

const contact2: SavedContact = {
  id: "c2",
  name: "Bob",
  phoneNumber: "5553334444",
};

describe("saved-contacts-store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loadSavedContacts", () => {
    it("returns empty array when nothing is stored", async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await loadSavedContacts();

      expect(result).toEqual([]);
    });

    it("loads and decrypts contacts from single key", async () => {
      const contacts = [contact1, contact2];
      const json = JSON.stringify(contacts);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await loadSavedContacts();

      expect(mockDecrypt).toHaveBeenCalledWith(`encrypted_${json}`);
      expect(result).toEqual(contacts);
    });

    it("loads and reassembles chunked data", async () => {
      const contacts = [contact1];
      const json = JSON.stringify(contacts);
      const encrypted = `encrypted_${json}`;
      const mid = Math.floor(encrypted.length / 2);
      const chunk0 = encrypted.substring(0, mid);
      const chunk1 = encrypted.substring(mid);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve("2");
        if (key === "saved_contacts_chunk_0") return Promise.resolve(chunk0);
        if (key === "saved_contacts_chunk_1") return Promise.resolve(chunk1);
        return Promise.resolve(null);
      });

      const result = await loadSavedContacts();

      expect(mockDecrypt).toHaveBeenCalledWith(encrypted);
      expect(result).toEqual(contacts);
    });

    it("returns empty array when a chunk is missing", async () => {
      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve("3");
        if (key === "saved_contacts_chunk_0") return Promise.resolve("aaa");
        if (key === "saved_contacts_chunk_1") return Promise.resolve(null);
        if (key === "saved_contacts_chunk_2") return Promise.resolve("ccc");
        return Promise.resolve(null);
      });

      const result = await loadSavedContacts();

      expect(result).toEqual([]);
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it("returns empty array on decryption failure", async () => {
      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data") return Promise.resolve("bad_data");
        return Promise.resolve(null);
      });
      mockDecrypt.mockRejectedValueOnce(new Error("Decryption failed"));

      const result = await loadSavedContacts();

      expect(result).toEqual([]);
    });
  });

  describe("saveSavedContacts", () => {
    it("encrypts and saves to single key for small payloads", async () => {
      const contacts = [contact1];
      const json = JSON.stringify(contacts);

      await saveSavedContacts(contacts);

      expect(mockEncrypt).toHaveBeenCalledWith(json);
      expect(mockSetItem).toHaveBeenCalledWith(
        "saved_contacts_data",
        `encrypted_${json}`
      );
    });

    it("uses chunking for large payloads", async () => {
      const largeEncrypted = "x".repeat(2000);
      mockEncrypt.mockResolvedValueOnce(largeEncrypted);

      await saveSavedContacts([contact1]);

      expect(mockSetItem).toHaveBeenCalledWith(
        "saved_contacts_chunk_count",
        expect.any(String)
      );
      expect(mockSetItem).toHaveBeenCalledWith(
        "saved_contacts_chunk_0",
        expect.any(String)
      );
      expect(mockSetItem).toHaveBeenCalledWith(
        "saved_contacts_chunk_1",
        expect.any(String)
      );
      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_data");
    });

    it("cleans up old chunks before saving", async () => {
      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve("3");
        return Promise.resolve(null);
      });

      await saveSavedContacts([contact1]);

      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_chunk_0");
      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_chunk_1");
      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_chunk_2");
      expect(mockDeleteItem).toHaveBeenCalledWith(
        "saved_contacts_chunk_count"
      );
    });

    it("throws on encryption failure", async () => {
      mockEncrypt.mockRejectedValueOnce(new Error("Encrypt failed"));

      await expect(saveSavedContacts([contact1])).rejects.toThrow(
        "Encrypt failed"
      );
    });
  });

  describe("addSavedContact", () => {
    it("adds a new contact", async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await addSavedContact(contact1);

      expect(result).toEqual([contact1]);
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it("skips duplicate phone numbers", async () => {
      const existing = [contact1];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const duplicate: SavedContact = {
        id: "c99",
        name: "Alice Duplicate",
        phoneNumber: "5551112222",
      };

      const result = await addSavedContact(duplicate);

      expect(result).toEqual(existing);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it("skips duplicate phone numbers with different formatting", async () => {
      const existing = [contact1];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const formattedDuplicate: SavedContact = {
        id: "c99",
        name: "Alice Formatted",
        phoneNumber: "(555) 111-2222",
      };

      const result = await addSavedContact(formattedDuplicate);

      expect(result).toEqual(existing);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it("adds contact with different phone number", async () => {
      const existing = [contact1];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await addSavedContact(contact2);

      expect(result).toEqual([contact1, contact2]);
      expect(mockEncrypt).toHaveBeenCalled();
    });
  });

  describe("removeSavedContact", () => {
    it("removes a contact by ID", async () => {
      const existing = [contact1, contact2];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await removeSavedContact("c1");

      expect(result).toEqual([contact2]);
      expect(mockEncrypt).toHaveBeenCalledWith(JSON.stringify([contact2]));
    });

    it("returns unchanged list when ID not found", async () => {
      const existing = [contact1];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await removeSavedContact("nonexistent");

      expect(result).toEqual(existing);
    });

    it("returns empty array when removing the last contact", async () => {
      const existing = [contact1];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await removeSavedContact("c1");

      expect(result).toEqual([]);
    });
  });

  describe("updateSavedContact", () => {
    it("updates contact name", async () => {
      const existing = [contact1, contact2];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await updateSavedContact("c1", { name: "Alice Updated" });

      expect(result[0].name).toBe("Alice Updated");
      expect(result[0].phoneNumber).toBe(contact1.phoneNumber);
      expect(result[1]).toEqual(contact2);
    });

    it("updates contact phone number", async () => {
      const existing = [contact1];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await updateSavedContact("c1", {
        phoneNumber: "9990001111",
      });

      expect(result[0].phoneNumber).toBe("9990001111");
      expect(result[0].name).toBe(contact1.name);
    });

    it("updates both name and phone number", async () => {
      const existing = [contact1];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await updateSavedContact("c1", {
        name: "New Name",
        phoneNumber: "0001112222",
      });

      expect(result[0]).toEqual({
        id: "c1",
        name: "New Name",
        phoneNumber: "0001112222",
      });
    });

    it("skips update when new phone number duplicates another contact", async () => {
      const existing = [contact1, contact2];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await updateSavedContact("c1", {
        phoneNumber: "5553334444",
      });

      expect(result).toEqual(existing);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it("leaves other contacts unchanged", async () => {
      const existing = [contact1, contact2];
      const json = JSON.stringify(existing);

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data")
          return Promise.resolve(`encrypted_${json}`);
        return Promise.resolve(null);
      });

      const result = await updateSavedContact("c2", { name: "Robert" });

      expect(result[0]).toEqual(contact1);
      expect(result[1].name).toBe("Robert");
    });
  });

  describe("clearSavedContacts", () => {
    it("deletes the single-key data", async () => {
      mockGetItem.mockResolvedValue(null);

      await clearSavedContacts();

      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_data");
    });

    it("deletes chunks when they exist", async () => {
      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve("2");
        return Promise.resolve(null);
      });

      await clearSavedContacts();

      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_chunk_0");
      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_chunk_1");
      expect(mockDeleteItem).toHaveBeenCalledWith(
        "saved_contacts_chunk_count"
      );
      expect(mockDeleteItem).toHaveBeenCalledWith("saved_contacts_data");
    });

    it("does not throw on delete errors", async () => {
      mockGetItem.mockResolvedValue(null);
      mockDeleteItem.mockRejectedValueOnce(new Error("Delete failed"));

      await expect(clearSavedContacts()).resolves.toBeUndefined();
    });
  });

  describe("round-trip persistence", () => {
    it("save then load returns the same contacts", async () => {
      const contacts = [contact1, contact2];
      let storedData: string | null = null;

      mockGetItem.mockImplementation((key: string) => {
        if (key === "saved_contacts_chunk_count") return Promise.resolve(null);
        if (key === "saved_contacts_data") return Promise.resolve(storedData);
        return Promise.resolve(null);
      });

      mockSetItem.mockImplementation((key: string, value: string) => {
        if (key === "saved_contacts_data") {
          storedData = value;
        }
        return Promise.resolve();
      });

      await saveSavedContacts(contacts);
      const loaded = await loadSavedContacts();

      expect(loaded).toEqual(contacts);
    });
  });
});
