import {
  transformToNilraFormat,
  sendIntakeToNilra,
  validateANumber,
} from "../nilra-api";
import type { LegalSupportData } from "../../components/LegalSupportForm";
import * as Sentry from "@sentry/react-native";

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock environment variables for testing
// Note: These are fake/placeholder values used only for unit tests.
// Real environment variables are configured in .env.local and EAS Secrets.
const mockEnv = {
  EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL: "https://test-function.example.com/nilra-api",
  EXPO_PUBLIC_TWILIO_API_SECRET: "test-secret-key-123",
};

describe("NILRA API Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set mock environment variables
    process.env.EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL = mockEnv.EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL;
    process.env.EXPO_PUBLIC_TWILIO_API_SECRET = mockEnv.EXPO_PUBLIC_TWILIO_API_SECRET;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL;
    delete process.env.EXPO_PUBLIC_TWILIO_API_SECRET;
  });

  const mockLegalSupportData: LegalSupportData = {
    firstName: "John",
    middleName: "Michael",
    lastName: "Doe",
    aNumber: "123456789",
    countryOfBirth: "Mexico",
    dateOfBirth: "1990-12-25",
    hasImmigrationAttorney: "Yes",
    immigrationAttorneyNotes: "Attorney John Smith at Law Firm XYZ",
    emergencyContactName: "Jane Doe",
    emergencyContactRelationship: "Spouse",
    emergencyContactEmail: "jane.doe@example.com",
    emergencyContactPhone: "+15551234567",
    canContactEmergencyContact: true,
    enableLocationSharing: true,
    canHRFContact: true,
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      timestamp: Date.now(),
    },
  };

  describe("transformToNilraFormat", () => {
    it("transforms complete legal support data correctly", () => {
      const result = transformToNilraFormat(mockLegalSupportData);

      expect(result).toEqual({
        hasImmigrationAttorney: "Yes",
        immigrationAttorneyNotes: "Attorney John Smith at Law Firm XYZ",
        alienNumber: "123456789",
        lastName: "Doe",
        middleName: "Michael",
        firstName: "John",
        birthDate: "1990-12-25",
        birthCountry: "Mexico",
        canContact: true,
        contactPerson: {
          relationship: "Spouse",
          lastName: "Doe",
          firstName: "Jane",
          phone: "+15551234567",
          email: "jane.doe@example.com",
        },
        latitudeLocation: 40.7128,
        longitudeLocation: -74.006,
        locationStreet: "",
        locationCity: "",
        locationState: "",
        locationZipCode: "",
      });
    });

    it("handles emergency contact with single name", () => {
      const data: LegalSupportData = {
        ...mockLegalSupportData,
        emergencyContactName: "Madonna",
      };

      const result = transformToNilraFormat(data);

      expect(result.contactPerson.firstName).toBe("Madonna");
      expect(result.contactPerson.lastName).toBe("");
    });

    it("handles emergency contact with multiple names", () => {
      const data: LegalSupportData = {
        ...mockLegalSupportData,
        emergencyContactName: "María José García López",
      };

      const result = transformToNilraFormat(data);

      expect(result.contactPerson.firstName).toBe("María");
      expect(result.contactPerson.lastName).toBe("José García López");
    });

    it("handles emergency contact with extra spaces", () => {
      const data: LegalSupportData = {
        ...mockLegalSupportData,
        emergencyContactName: "  John   Doe  ",
      };

      const result = transformToNilraFormat(data);

      expect(result.contactPerson.firstName).toBe("John");
      expect(result.contactPerson.lastName).toBe("Doe");
    });

    it("handles missing optional fields", () => {
      const minimalData: LegalSupportData = {
        firstName: "John",
        middleName: "",
        lastName: "Doe",
        aNumber: "",
        countryOfBirth: "",
        dateOfBirth: "",
        hasImmigrationAttorney: "",
        immigrationAttorneyNotes: "",
        emergencyContactName: "Jane Doe",
        emergencyContactRelationship: "",
        emergencyContactEmail: "",
        emergencyContactPhone: "",
        canContactEmergencyContact: false,
        enableLocationSharing: false,
        canHRFContact: false,
      };

      const result = transformToNilraFormat(minimalData);

      expect(result.hasImmigrationAttorney).toBe("Unknown");
      expect(result.immigrationAttorneyNotes).toBe("");
      expect(result.alienNumber).toBeNull();
      expect(result.middleName).toBe("");
      expect(result.birthDate).toBe("");
      expect(result.birthCountry).toBe("");
      expect(result.canContact).toBe(false);
      expect(result.latitudeLocation).toBeNull();
      expect(result.longitudeLocation).toBeNull();
    });

    it("handles whitespace-only A-Number as null", () => {
      const data: LegalSupportData = {
        ...mockLegalSupportData,
        aNumber: "   ",
      };

      const result = transformToNilraFormat(data);

      expect(result.alienNumber).toBeNull();
    });

    it("trims A-Number whitespace", () => {
      const data: LegalSupportData = {
        ...mockLegalSupportData,
        aNumber: "  123456789  ",
      };

      const result = transformToNilraFormat(data);

      expect(result.alienNumber).toBe("123456789");
    });

    it("handles missing location data", () => {
      const data: LegalSupportData = {
        ...mockLegalSupportData,
        location: undefined,
      };

      const result = transformToNilraFormat(data);

      expect(result.latitudeLocation).toBeNull();
      expect(result.longitudeLocation).toBeNull();
    });

    it("sets location fields to empty strings", () => {
      const result = transformToNilraFormat(mockLegalSupportData);

      expect(result.locationStreet).toBe("");
      expect(result.locationCity).toBe("");
      expect(result.locationState).toBe("");
      expect(result.locationZipCode).toBe("");
    });

    it('handles "Unknown" immigration attorney status', () => {
      const data: LegalSupportData = {
        ...mockLegalSupportData,
        hasImmigrationAttorney: "",
      };

      const result = transformToNilraFormat(data);

      expect(result.hasImmigrationAttorney).toBe("Unknown");
    });
  });

  describe("sendIntakeToNilra", () => {
    it("successfully sends data to Twilio NILRA handler", async () => {
      const mockResponse = {
        title: "Success",
        status: 200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(
        mockLegalSupportData,
        "test-user-id",
        "+15551234567",
        "en"
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        "https://test-function.example.com/nilra-api",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("intakeData"),
        })
      );

      // Verify the payload structure
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload).toHaveProperty("intakeData");
      expect(payload).toHaveProperty("metadata");
      expect(payload.metadata).toEqual({
        userId: "test-user-id",
        phoneNumber: "+15551234567",
        appLanguage: "en",
        timestamp: expect.any(String),
      });
    });

    it("includes metadata in the request", async () => {
      const mockResponse = {
        title: "Success",
        status: 200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      await sendIntakeToNilra(
        mockLegalSupportData,
        "user-123",
        "+15551234567",
        "es"
      );

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      
      expect(payload.metadata).toEqual({
        userId: "user-123",
        phoneNumber: "+15551234567",
        appLanguage: "es",
        timestamp: expect.any(String),
      });
    });

    it("uses default metadata values when not provided", async () => {
      const mockResponse = {
        title: "Success",
        status: 200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      await sendIntakeToNilra(mockLegalSupportData);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      
      expect(payload.metadata.userId).toBe("unknown");
      expect(payload.metadata.phoneNumber).toBe("unknown");
      expect(payload.metadata.appLanguage).toBe("en");
    });

    it("throws error when Twilio function URL is not configured", async () => {
      delete process.env.EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL;

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NILRA Twilio function URL not configured");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("throws error when Twilio API secret is not configured", async () => {
      delete process.env.EXPO_PUBLIC_TWILIO_API_SECRET;

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Twilio API secret not configured");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("handles 400 error response from Twilio proxy", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: jest.fn().mockResolvedValue("Invalid data format"),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("400");
      expect(result.error).toContain("NILRA proxy");
    });

    it("handles 500 error response from Twilio proxy", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: jest.fn().mockResolvedValue("Server error"),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("never puts the proxy response body in the error or in Sentry", async () => {
      // The body is a reply about an immigration legal intake and can echo the
      // applicant's name, date of birth or A-Number back to us.
      const body = '{"firstName":"Maria","alienNumber":"847334156"}';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        text: jest.fn().mockResolvedValue(body),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.error).not.toContain("Maria");
      expect(result.error).not.toContain("847334156");

      const sentryCall = (Sentry.captureException as jest.Mock).mock.calls.at(-1);
      expect(JSON.stringify(sentryCall)).not.toContain("Maria");
      expect(JSON.stringify(sentryCall)).not.toContain("847334156");
      expect(sentryCall?.[1]?.extra).toBeUndefined();
    });


    it("handles non-200 success status in response body", async () => {
      const mockResponse = {
        title: "Validation Error",
        status: 400,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Validation Error");
    });

    it("handles invalid JSON response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue("Not valid JSON"),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to parse NILRA API response");
    });

    it("handles network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("handles timeout errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Request timeout"));

      const result = await sendIntakeToNilra(mockLegalSupportData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });

    it("sends correct request body", async () => {
      const mockResponse = {
        title: "Success",
        status: 200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      await sendIntakeToNilra(mockLegalSupportData);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      // The body now contains intakeData and metadata
      expect(requestBody).toHaveProperty("intakeData");
      expect(requestBody).toHaveProperty("metadata");
      
      expect(requestBody.intakeData).toHaveProperty("firstName", "John");
      expect(requestBody.intakeData).toHaveProperty("lastName", "Doe");
      expect(requestBody.intakeData).toHaveProperty("alienNumber", "123456789");
      expect(requestBody.intakeData).toHaveProperty("birthDate", "1990-12-25");
      expect(requestBody.intakeData).toHaveProperty("birthCountry", "Mexico");
      expect(requestBody.intakeData.contactPerson).toHaveProperty("firstName", "Jane");
      expect(requestBody.intakeData.contactPerson).toHaveProperty("lastName", "Doe");
    });

    it("accepts optional parameters", async () => {
      const mockResponse = {
        title: "Success",
        status: 200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(
        mockLegalSupportData,
        "user-123",
        "+15551234567",
        "en"
      );

      expect(result.success).toBe(true);
    });
  });

  describe("validateANumber", () => {
    it("validates correct 9-digit A-Number", () => {
      expect(validateANumber("987654321")).toBe(true);
      expect(validateANumber("111222333")).toBe(true);
      expect(validateANumber("456789012")).toBe(true);
    });

    it("allows empty A-Number (optional field)", () => {
      expect(validateANumber("")).toBe(true);
    });

    it("rejects A-Number with less than 9 digits", () => {
      expect(validateANumber("12345678")).toBe(false);
      expect(validateANumber("1234")).toBe(false);
      expect(validateANumber("1")).toBe(false);
    });

    it("rejects A-Number with more than 9 digits", () => {
      expect(validateANumber("1234567890")).toBe(false);
      expect(validateANumber("12345678901")).toBe(false);
    });

    it("rejects A-Number with non-digit characters", () => {
      expect(validateANumber("12345678a")).toBe(false);
      expect(validateANumber("A12345678")).toBe(false);
      expect(validateANumber("123-456-789")).toBe(false);
      expect(validateANumber("123 456 789")).toBe(false);
      expect(validateANumber("123.456.789")).toBe(false);
    });

    it("rejects invalid patterns", () => {
      expect(validateANumber("000000000")).toBe(false);
      expect(validateANumber("123456789")).toBe(false);
      expect(validateANumber("123123123")).toBe(false);
    });

    it("rejects A-Number with special characters", () => {
      expect(validateANumber("!@#$%^&*()")).toBe(false);
      expect(validateANumber("12345678!")).toBe(false);
    });

    it("rejects A-Number with spaces", () => {
      expect(validateANumber("123 456 789")).toBe(false);
      expect(validateANumber(" 123456789")).toBe(false);
      expect(validateANumber("123456789 ")).toBe(false);
    });

    it("validates various valid patterns", () => {
      expect(validateANumber("111111111")).toBe(true);
      expect(validateANumber("999999999")).toBe(true);
      expect(validateANumber("246813579")).toBe(true);
      expect(validateANumber("135792468")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles data with special characters in names", async () => {
      const dataWithSpecialChars: LegalSupportData = {
        ...mockLegalSupportData,
        firstName: "José",
        lastName: "García",
        emergencyContactName: "María López",
      };

      const mockResponse = {
        title: "Success",
        status: 200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(dataWithSpecialChars);

      expect(result.success).toBe(true);
    });

    it("handles very long attorney notes", async () => {
      const dataWithLongNotes: LegalSupportData = {
        ...mockLegalSupportData,
        immigrationAttorneyNotes: "A".repeat(5000),
      };

      const mockResponse = {
        title: "Success",
        status: 200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
        headers: new Headers(),
      });

      const result = await sendIntakeToNilra(dataWithLongNotes);

      expect(result.success).toBe(true);
    });

    it("handles location with zero coordinates as falsy (returns null)", () => {
      const dataWithZeroLocation: LegalSupportData = {
        ...mockLegalSupportData,
        location: {
          latitude: 0,
          longitude: 0,
        },
      };

      const result = transformToNilraFormat(dataWithZeroLocation);

      // Zero coordinates are treated as falsy by the || operator and return null
      // This is the current implementation behavior
      expect(result.latitudeLocation).toBeNull();
      expect(result.longitudeLocation).toBeNull();
    });

    it("handles negative coordinates", () => {
      const dataWithNegativeCoords: LegalSupportData = {
        ...mockLegalSupportData,
        location: {
          latitude: -33.8688,
          longitude: -151.2093,
        },
      };

      const result = transformToNilraFormat(dataWithNegativeCoords);

      expect(result.latitudeLocation).toBe(-33.8688);
      expect(result.longitudeLocation).toBe(-151.2093);
    });

    it("handles empty email string", () => {
      const dataWithEmptyEmail: LegalSupportData = {
        ...mockLegalSupportData,
        emergencyContactEmail: "",
      };

      const result = transformToNilraFormat(dataWithEmptyEmail);

      expect(result.contactPerson.email).toBe("");
    });
  });
});

