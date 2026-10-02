/**
 * validateDeepLink guards a trust boundary: a URL that passes is one the app
 * will act on. The verified-domain list used to be hardcoded to the
 * development Auth0 tenant; it now derives from the configured tenant, and
 * these tests pin that it tracks configuration rather than a literal.
 */

jest.mock("react-native", () => ({ Linking: { addEventListener: jest.fn() } }));
jest.mock("expo-web-browser", () => ({}));

const CONFIGURED_DOMAIN = "configured-tenant.us.auth0.com";
const CALLBACK = "/android/com.innovationlab.alertbuttonexpo/callback";

jest.mock("../auth-config", () => ({
  AUTH0_CONFIG: {
    domain: "configured-tenant.us.auth0.com",
    clientId: "test-client-id",
  },
}));

import { validateDeepLink } from "../secure-deep-links";

describe("validateDeepLink", () => {
  it("accepts a callback on the configured Auth0 tenant", () => {
    const result = validateDeepLink(`https://${CONFIGURED_DOMAIN}${CALLBACK}`);
    expect(result.isValid).toBe(true);
    expect(result.domain).toBe(CONFIGURED_DOMAIN);
  });

  it("accepts a callback with a longer path under the prefix", () => {
    const result = validateDeepLink(
      `https://${CONFIGURED_DOMAIN}${CALLBACK}?code=abc123`
    );
    expect(result.isValid).toBe(true);
  });

  it("rejects the previously hardcoded development tenant", () => {
    // The regression this file exists for: before the allowlist derived from
    // configuration, this domain was trusted in every build.
    const result = validateDeepLink(
      `https://hrf-alt-dev.us.auth0.com${CALLBACK}`
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Unverified domain/);
  });

  it("rejects an unrelated domain", () => {
    const result = validateDeepLink(`https://evil.example.com${CALLBACK}`);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Unverified domain/);
  });

  it("rejects a lookalike subdomain of the configured tenant", () => {
    const result = validateDeepLink(
      `https://configured-tenant.us.auth0.com.evil.example.com${CALLBACK}`
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Unverified domain/);
  });

  it("rejects a valid domain with an unexpected path", () => {
    const result = validateDeepLink(`https://${CONFIGURED_DOMAIN}/admin`);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Invalid path/);
  });

  it("rejects plain HTTP on the configured tenant", () => {
    const result = validateDeepLink(`http://${CONFIGURED_DOMAIN}${CALLBACK}`);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Invalid protocol/);
  });

  it("rejects a custom scheme", () => {
    const result = validateDeepLink(`readynow://${CONFIGURED_DOMAIN}${CALLBACK}`);
    expect(result.isValid).toBe(false);
  });

  it("rejects a malformed URL without throwing", () => {
    const result = validateDeepLink("not a url");
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Invalid URL format/);
  });
});
