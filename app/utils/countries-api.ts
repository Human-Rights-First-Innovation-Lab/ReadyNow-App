/**
 * Utility for fetching countries list from NILRA API via Twilio Function proxy
 */

import * as Sentry from "@sentry/react-native";

interface CountriesApiResponse {
  countries: string[];
  count: number;
}

/**
 * Fetch list of countries from NILRA API via Twilio Function
 * @returns Array of country names
 */
export const fetchCountries = async (): Promise<string[]> => {
  try {
    const TWILIO_COUNTRIES_URL = process.env.EXPO_PUBLIC_TWILIO_COUNTRIES_URL;
    const TWILIO_API_SECRET = process.env.EXPO_PUBLIC_TWILIO_API_SECRET;

    if (!TWILIO_COUNTRIES_URL) {
      throw new Error("Countries API URL not configured");
    }

    if (!TWILIO_API_SECRET) {
      throw new Error("Twilio API secret not configured");
    }

    const payload = {
      apiKey: TWILIO_API_SECRET,
    };

    const response = await fetch(TWILIO_COUNTRIES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Body deliberately omitted: this error is reported to Sentry, and the
      // response body is not guaranteed to be free of request echoes.
      throw new Error(`Countries API returned status ${response.status}`);
    }

    const responseText = await response.text();
    
    let result: CountriesApiResponse;
    try {
      result = JSON.parse(responseText) as CountriesApiResponse;
    } catch (parseError) {
      throw new Error("Failed to parse countries API response");
    }

    if (!result.countries || !Array.isArray(result.countries)) {
      throw new Error("Invalid countries API response format");
    }

    return result.countries;

  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        service: "countries-api",
        action: "fetch_countries",
      },
      level: "error",
    });
    return [];
  }
};

