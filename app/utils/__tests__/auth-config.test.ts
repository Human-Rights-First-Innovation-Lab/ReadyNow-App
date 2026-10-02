/**
 * formatPhoneNumberForAuth0 previously prefixed "+1" onto whatever it was
 * given, which silently corrupted any number that already carried a country
 * code. These tests pin the cases that used to break.
 */

const ENV = {
  EXPO_PUBLIC_AUTH0_DOMAIN: "example.us.auth0.com",
  EXPO_PUBLIC_AUTH0_CLIENT_ID: "test-client-id",
  EXPO_PUBLIC_AUTH0_AUDIENCE: "https://example.test/api",
  EXPO_PUBLIC_AUTH0_REDIRECT_URI: "readynow://callback",
};

describe("formatPhoneNumberForAuth0", () => {
  let formatPhoneNumberForAuth0: (phone: string) => string;

  beforeAll(() => {
    Object.assign(process.env, ENV);
    // auth-config throws at import time on missing env vars, so require it
    // only once the environment above is in place.
    formatPhoneNumberForAuth0 =
      require("../auth-config").formatPhoneNumberForAuth0;
  });

  describe("bare national numbers default to +1", () => {
    it("formats ten digits", () => {
      expect(formatPhoneNumberForAuth0("2125550143")).toBe("+12125550143");
    });

    it("strips punctuation from the display format", () => {
      expect(formatPhoneNumberForAuth0("(212) 555-0143")).toBe("+12125550143");
    });
  });

  describe("numbers that already carry a country code", () => {
    it("preserves a non-US country code instead of prefixing +1", () => {
      expect(formatPhoneNumberForAuth0("+44 7700 900123")).toBe(
        "+447700900123"
      );
    });

    it("does not double the country code on a US number typed with +1", () => {
      expect(formatPhoneNumberForAuth0("+1 212 555 0143")).toBe("+12125550143");
    });

    it("treats 11 digits beginning with 1 as NANP, not a national number", () => {
      expect(formatPhoneNumberForAuth0("12125550143")).toBe("+12125550143");
    });

    it("leaves an already-formatted E.164 number unchanged", () => {
      expect(formatPhoneNumberForAuth0("+12125550143")).toBe("+12125550143");
    });
  });

  describe("input hygiene", () => {
    it("tolerates surrounding whitespace", () => {
      expect(formatPhoneNumberForAuth0("  2125550143  ")).toBe("+12125550143");
    });

    it("keeps a long international number intact", () => {
      expect(formatPhoneNumberForAuth0("+81 3 1234 5678")).toBe("+81312345678");
    });
  });
});
