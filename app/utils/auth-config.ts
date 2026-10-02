// Helper function to get required environment variable
const getRequiredEnvVar = (value: string | undefined, varName: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
  return value;
};

// Auth0 Configuration - all values from environment variables
export const AUTH0_CONFIG = {
  domain: getRequiredEnvVar(process.env.EXPO_PUBLIC_AUTH0_DOMAIN, "EXPO_PUBLIC_AUTH0_DOMAIN"),
  clientId: getRequiredEnvVar(process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID, "EXPO_PUBLIC_AUTH0_CLIENT_ID"),
  audience: getRequiredEnvVar(process.env.EXPO_PUBLIC_AUTH0_AUDIENCE, "EXPO_PUBLIC_AUTH0_AUDIENCE"),

  // Connection settings
  connection: process.env.EXPO_PUBLIC_AUTH0_CONNECTION || "sms",
  
  // Auth0 callback URI
  redirectUri: getRequiredEnvVar(process.env.EXPO_PUBLIC_AUTH0_REDIRECT_URI, "EXPO_PUBLIC_AUTH0_REDIRECT_URI")

};

/**
 * Format a phone number as E.164 for Auth0.
 *
 * This used to strip every non-digit and unconditionally prefix "+1", which
 * corrupted anything that already carried a country code: "+44 7700 900123"
 * became "+1447700900123", and a US number typed as "+1 646..." became
 * "+11646...". A country code supplied by the caller is now preserved.
 *
 * Defaulting to +1 for a bare national number is correct by decision, not by
 * omission: ReadyNow addresses the US immigration situation and does not
 * support international numbers. Every phone input truncates to ten digits
 * behind a (xxx)-xxx-xxxx mask, so a country code cannot be entered anyway.
 * The country-code branch below exists to stop a latent bug, not to enable
 * international use - see docs/international-phone-numbers.md.
 */
export const formatPhoneNumberForAuth0 = (phoneNumber: string): string => {
  const trimmed = phoneNumber.trim();

  // Already E.164: keep whatever country code the caller supplied.
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const cleaned = trimmed.replace(/\D/g, "");

  // 11 digits starting with 1 is a NANP number that already carries its
  // country code; prefixing another +1 would break it.
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  return `+1${cleaned}`;
}; 

export default AUTH0_CONFIG;
