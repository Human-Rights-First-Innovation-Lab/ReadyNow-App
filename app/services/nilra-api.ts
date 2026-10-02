import * as Sentry from "@sentry/react-native";
import { LegalSupportData } from "../components/LegalSupportForm";

interface NilraIntakeData {
  hasImmigrationAttorney: string;
  immigrationAttorneyNotes: string;
  alienNumber: string | null;
  lastName: string;
  middleName: string;
  firstName: string;
  birthDate: string; // ISO date string (YYYY-MM-DD)
  birthCountry: string;
  canContact: boolean;
  contactPerson: {
    relationship: string;
    lastName: string;
    firstName: string;
    phone: string;
    email: string;
  };
  latitudeLocation: number | null;
  longitudeLocation: number | null;
  locationStreet: string;
  locationCity: string;
  locationState: string;
  locationZipCode: string;
}

interface NilraApiResponse {
  title: string;
  status: number;
}

/**
 * Transform LegalSupportData to NILRA API format
 */
export const transformToNilraFormat = (
  legalSupportData: LegalSupportData
): NilraIntakeData => {
  // Parse emergency contact name to get first and last name
  // Use regex to split by one or more spaces
  const contactNameParts = legalSupportData.emergencyContactName.trim().split(/\s+/);
  const contactFirstName = contactNameParts[0] || "";
  // Join all parts after the first as the last name (handles middle names, multiple last names, etc.)
  const contactLastName = contactNameParts.slice(1).join(" ") || "";

  // Handle email - the API seems to require a valid email always
  // If no email is provided, we need to decide how to handle this
  let contactEmail = legalSupportData.emergencyContactEmail || "";
  
  // If email is empty and the API requires it, we might need to provide a placeholder
  // But first, let's check if the API accepts null or if it needs a valid email
  
  return {
    hasImmigrationAttorney: legalSupportData.hasImmigrationAttorney || "Unknown",
    immigrationAttorneyNotes: legalSupportData.immigrationAttorneyNotes || "",
    alienNumber: legalSupportData.aNumber && legalSupportData.aNumber.trim() ? legalSupportData.aNumber.trim() : null,
    lastName: legalSupportData.lastName || "",
    middleName: legalSupportData.middleName || "",
    firstName: legalSupportData.firstName || "",
    birthDate: legalSupportData.dateOfBirth || "",
    birthCountry: legalSupportData.countryOfBirth || "",
    canContact: legalSupportData.canContactEmergencyContact || false,
    contactPerson: {
      relationship: legalSupportData.emergencyContactRelationship || "",
      lastName: contactLastName,
      firstName: contactFirstName,
      phone: legalSupportData.emergencyContactPhone || "",
      email: contactEmail,
    },
    latitudeLocation: legalSupportData.location?.latitude || null,
    longitudeLocation: legalSupportData.location?.longitude || null,
    locationStreet: "", // Not collected in current form
    locationCity: "", // Not collected in current form
    locationState: "", // Not collected in current form
    locationZipCode: "", // Not collected in current form
  };
};

/**
 * Send intake data to NILRA API via Twilio Function proxy
 * This approach keeps the NILRA API key secure on the server-side
 */
export const sendIntakeToNilra = async (
  legalSupportData: LegalSupportData,
  userId?: string,
  phoneNumber?: string,
  appLanguage?: string
): Promise<{ success: boolean; error?: string }> => {
  
  try {
    const TWILIO_NILRA_HANDLER_URL = process.env.EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL;
    const TWILIO_API_SECRET = process.env.EXPO_PUBLIC_TWILIO_API_SECRET;

    if (!TWILIO_NILRA_HANDLER_URL) {
      throw new Error("NILRA Twilio function URL not configured");
    }

    if (!TWILIO_API_SECRET) {
      throw new Error("Twilio API secret not configured");
    }

    const intakeData = transformToNilraFormat(legalSupportData);
    
    const payload = {
      intakeData,
      metadata: {
        userId: userId || "unknown",
        phoneNumber: phoneNumber || "unknown",
        appLanguage: appLanguage || "en",
        timestamp: new Date().toISOString(),
      },
      auth: {
        apiKey: TWILIO_API_SECRET,
      },
    };

    const response = await fetch(TWILIO_NILRA_HANDLER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  
    if (!response.ok) {
      const errorMessage = `NILRA proxy returned status ${response.status}`;

      // Log to Sentry for visibility. The response body is deliberately not
      // attached: it is a reply about an immigration legal intake and may echo
      // back the applicant's name, date of birth or A-number.
      Sentry.captureException(new Error(errorMessage), {
        tags: {
          service: "nilra-api",
          action: "send_intake",
          status: response.status,
        },
        level: "error",
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const responseText = await response.text();
    
    let result: NilraApiResponse;
    try {
      result = JSON.parse(responseText) as NilraApiResponse;
    } catch (parseError) {
      // Log parse errors to Sentry
      Sentry.captureException(parseError, {
        tags: {
          service: "nilra-api",
          action: "parse_response",
        },
        level: "error",
      });
      
      return {
        success: false,
        error: "Failed to parse NILRA API response",
      };
    }
    
    const isSuccess = result.status === 200;

    // Log non-200 responses from NILRA API
    if (!isSuccess) {
      Sentry.captureMessage("NILRA API returned non-200 status", {
        tags: {
          service: "nilra-api",
          action: "send_intake",
          nilraStatus: result.status,
        },
        level: "warning",
      });
    }

    return {
      success: isSuccess,
      error: !isSuccess ? result.title : undefined,
    };
  } catch (error) {
    // Log unexpected errors to Sentry
    Sentry.captureException(error, {
      tags: {
        service: "nilra-api",
        action: "send_intake",
      },
      level: "error",
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Validate A-Number format according to NILRA requirements
 */
export const validateANumber = (aNumber: string): boolean => {
  if (!aNumber) return true; // A-Number is optional
  
  // Must be 9 digits
  if (aNumber.length !== 9) return false;
  
  // Must be all digits
  if (!/^\d{9}$/.test(aNumber)) return false;
  
  // Cannot be certain patterns
  const invalidPatterns = ["000000000", "123456789", "123123123"];
  if (invalidPatterns.includes(aNumber)) return false;
  
  return true;
}; 

export default {
  sendIntakeToNilra,
  validateANumber,
};