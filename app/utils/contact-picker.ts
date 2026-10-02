import { Alert, Linking } from "react-native";

type ContactsModule = typeof import("expo-contacts");
type ExpoContact = import("expo-contacts").Contact;

/**
 * Result of picking a contact from the device
 */
export interface PickedContact {
  name: string;
  phoneNumber: string;
}

/**
 * Normalize a US phone number to 10 digits (strips country code, spaces, dashes, etc.)
 */
const normalizePhoneNumber = (raw: string): string => {
  // Remove all non-digit characters
  let digits = raw.replace(/\D/g, "");

  // If it starts with "1" and is 11 digits, strip the leading country code
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  // Limit to 10 digits
  return digits.slice(0, 10);
};

/**
 * Dynamically load the native `expo-contacts` module.
 * Returns the module when available, otherwise returns null and shows a user-facing alert.
 */
const loadContactsModule = async (): Promise<ContactsModule | null> => {
  try {
    return await import("expo-contacts");
  } catch (error) {
    console.error("expo-contacts native module is unavailable:", error);
    Alert.alert(
      "Contacts Unavailable",
      "Contacts access is not available in this runtime. Please use a development build (or update Expo Go) and try again."
    );
    return null;
  }
};

/**
 * Request contacts permission with a user-friendly rationale.
 * Returns true if permission is granted.
 */
const requestContactsPermission = async (
  Contacts: ContactsModule
): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Contacts.getPermissionsAsync();

    if (existingStatus === "granted") {
      return true;
    }

    // Request permission
    const { status } = await Contacts.requestPermissionsAsync();

    if (status === "granted") {
      return true;
    }

    // Permission denied – show alert directing user to settings
    Alert.alert(
      "Contacts Access Required",
      "ReadyNow needs access to your contacts so you can quickly add emergency contacts. Please enable contacts access in your device settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );

    return false;
  } catch (error) {
    console.error("Error requesting contacts permission:", error);
    return false;
  }
};

/**
 * Build a display name from a contact's name fields.
 * Tries the pre-built `name`, then falls back to assembling from
 * firstName / middleName / lastName, and finally nickname/company.
 */
const buildContactName = (contact: ExpoContact): string => {
  // Prefer the pre-built display name if available
  if (contact.name && contact.name.trim().length > 0) {
    return contact.name.trim();
  }

  // Otherwise assemble from first / middle / last
  const parts: string[] = [];
  if (contact.firstName) parts.push(contact.firstName);
  if (contact.middleName) parts.push(contact.middleName);
  if (contact.lastName) parts.push(contact.lastName);

  const assembled = parts.join(" ").trim();
  if (assembled.length > 0) {
    return assembled;
  }

  // Fall back to nickname or company if present
  if (contact.nickname && contact.nickname.trim().length > 0) {
    return contact.nickname.trim();
  }

  if (contact.company && contact.company.trim().length > 0) {
    return contact.company.trim();
  }

  return "";
};

/**
 * Create a safe fallback display name when the contact record has no name fields.
 */
const fallbackNameFromPhone = (phoneNumber: string): string => {
  const lastFour = phoneNumber.slice(-4);
  return lastFour ? `Contact ${lastFour}` : "Contact";
};

/**
 * Open the device contacts and let the user pick one.
 * Returns the picked contact's name and phone number, or null if cancelled / unavailable.
 *
 * On iOS the native picker (`presentContactPickerAsync`) returns a limited
 * contact object where name fields are often empty because the serialiser
 * doesn't request the `CNContactFormatter` descriptor.  To work around this
 * we re-fetch the full contact by ID with explicit name fields after the
 * picker returns.
 */
export const pickContact = async (): Promise<PickedContact | null> => {
  const Contacts = await loadContactsModule();
  if (!Contacts) {
    return null;
  }

  const granted = await requestContactsPermission(Contacts);
  if (!granted) {
    return null;
  }

  try {
    const pickedContact = await Contacts.presentContactPickerAsync();

    if (!pickedContact) {
      return null;
    }

    // ---- Extract phone number from the picker result (usually present) ----
    let phoneNumber =
      pickedContact.phoneNumbers && pickedContact.phoneNumbers.length > 0
        ? normalizePhoneNumber(pickedContact.phoneNumbers[0].number ?? "")
        : "";

    // ---- Try to get the name from the picker result first ----
    let name = buildContactName(pickedContact);

    // ---- Re-fetch the full contact by ID to ensure name fields are available ----
    if (pickedContact.id) {
      try {
        const fullContact = await Contacts.getContactByIdAsync(
          pickedContact.id,
          [
            Contacts.Fields.FirstName,
            Contacts.Fields.MiddleName,
            Contacts.Fields.LastName,
            Contacts.Fields.Nickname,
            Contacts.Fields.Company,
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
          ]
        );

        if (fullContact) {
          const fullName = buildContactName(fullContact);
          if (fullName) {
            name = fullName;
          }

          // Also grab the phone number from the full contact if we didn't get one
          if (
            !phoneNumber &&
            fullContact.phoneNumbers &&
            fullContact.phoneNumbers.length > 0
          ) {
            phoneNumber = normalizePhoneNumber(
              fullContact.phoneNumbers[0].number ?? ""
            );
          }
        }
      } catch (refetchError) {
        console.error("Error re-fetching contact by ID:", refetchError);
        // Continue with whatever we got from the picker
      }
    }

    // Handle partial data gracefully:
    // - phone number is required for this flow
    // - name falls back to a deterministic placeholder if unavailable
    if (!phoneNumber) {
      Alert.alert(
        "Contact Missing Phone Number",
        "The selected contact does not have a phone number. Please choose another contact."
      );
      return null;
    }

    if (!name) {
      name = fallbackNameFromPhone(phoneNumber);
    }

    return { name, phoneNumber };
  } catch (error) {
    console.error("Error picking contact:", error);
    return null;
  }
};
