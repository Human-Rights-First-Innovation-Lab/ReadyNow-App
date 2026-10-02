import * as SecureStore from "expo-secure-store";
import {
  getDeviceCredential,
  hasDeviceCredential,
  registerDeviceCredential,
  ensureDeviceCredential,
  clearDeviceCredential,
} from "../device-credential";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn().mockResolvedValue("f".repeat(64)),
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
}));

jest.mock("../secureRandom", () => ({
  generateSecureUUID: () => "8f14e45f-ceea-467a-9575-3b2d4c2f9a11",
  generateSecureBytes: (n: number) => new Uint8Array(n).fill(7),
}));

// device-credential.ts imports auth-service.ts for getFreshAccessToken(),
// which in turn imports auth-config.ts - which throws at import time if the
// EXPO_PUBLIC_AUTH0_* env vars are unset, as they are under Jest. Mocking
// auth-service directly (below) means auth-config is never actually reached,
// but the mock factory must still exist so requiring it does not fail.
jest.mock("../auth-config", () => ({
  AUTH0_CONFIG: { domain: "test.auth0.com", clientId: "test-client-id" },
  formatPhoneNumberForAuth0: (phone: string) => phone,
}));

jest.mock("../auth-service", () => ({
  getFreshAccessToken: jest.fn(),
}));

import { getFreshAccessToken } from "../auth-service";

const store: Record<string, string | null> = {};

describe("device credential", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
    process.env.EXPO_PUBLIC_ALERT_URL = "https://example.twil.io/alert";
    global.fetch = jest.fn();

    (SecureStore.getItemAsync as jest.Mock).mockImplementation((k: string) =>
      Promise.resolve(store[k] ?? null)
    );
    (SecureStore.setItemAsync as jest.Mock).mockImplementation((k: string, v: string) => {
      store[k] = v;
      return Promise.resolve();
    });
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((k: string) => {
      delete store[k];
      return Promise.resolve();
    });
  });

  it("reports no credential before registration", async () => {
    expect(await getDeviceCredential()).toBeNull();
    expect(await hasDeviceCredential()).toBe(false);
  });

  it("registers, sending only the hash", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    expect(await registerDeviceCredential("auth0-token")).toBe(true);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body.action).toBe("register");
    expect(body.secretHash).toBe("f".repeat(64));
    // The secret itself must never leave the device.
    expect(init.body).not.toContain(store["alert_credential_secret"]);
    expect(init.headers.Authorization).toBe("Bearer auth0-token");
  });

  it("produces a bearer of the form <id>.<secret>", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
    await registerDeviceCredential("auth0-token");

    const credential = await getDeviceCredential();
    expect(credential).toBe(
      `8f14e45f-ceea-467a-9575-3b2d4c2f9a11.${store["alert_credential_secret"]}`
    );
  });

  it("does not keep a local credential the server rejected", async () => {
    // Keeping one would fail at the worst possible moment and look to the user
    // like a lost alert rather than a setup problem.
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });

    expect(await registerDeviceCredential("bad-token")).toBe(false);
    expect(await hasDeviceCredential()).toBe(false);
  });

  it("does not keep a local credential when the network fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    expect(await registerDeviceCredential("auth0-token")).toBe(false);
    expect(await hasDeviceCredential()).toBe(false);
  });

  it("is a no-op once a credential exists", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
    await registerDeviceCredential("auth0-token");
    (global.fetch as jest.Mock).mockClear();

    expect(await registerDeviceCredential("auth0-token")).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe("ensureDeviceCredential", () => {
    it("heals a registration that failed at sign-up", async () => {
      (getFreshAccessToken as jest.Mock).mockResolvedValue("auth0-token");
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      expect(await ensureDeviceCredential()).toBe(true);
      expect(await hasDeviceCredential()).toBe(true);
    });

    it("does nothing when no access token can be obtained (not signed in, or refresh failed)", async () => {
      (getFreshAccessToken as jest.Mock).mockResolvedValue(null);

      expect(await ensureDeviceCredential()).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("does not re-register when a credential is already present", async () => {
      store["alert_credential_id"] = "id";
      store["alert_credential_secret"] = "secret";

      expect(await ensureDeviceCredential()).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it("clears both halves of the credential", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
    await registerDeviceCredential("auth0-token");

    await clearDeviceCredential();
    expect(await getDeviceCredential()).toBeNull();
  });
});
