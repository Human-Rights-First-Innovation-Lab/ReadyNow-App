import { prepareAlert, stageAlert, fireAlert, cancelAlert } from "../alert-api";
import { getDeviceCredential } from "../../utils/device-credential";

jest.mock("../../utils/device-credential", () => ({
  getDeviceCredential: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn().mockResolvedValue("a".repeat(64)),
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
}));

jest.mock("../../utils/secureRandom", () => ({
  generateSecureUUID: () => "8f14e45f-ceea-467a-9575-3b2d4c2f9a11",
  generateSecureBytes: (n: number) =>
    new Uint8Array(jest.requireActual("crypto").randomBytes(n)),
}));

const groups = [
  { body: "Please help", to: ["+15551234567"], names: ["Ana"] },
];

describe("alert-api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    process.env.EXPO_PUBLIC_ALERT_URL = "https://example.twil.io/alert";
    (getDeviceCredential as jest.Mock).mockResolvedValue("cred-id.secret");
    global.fetch = jest.fn();
  });

  describe("prepareAlert", () => {
    it("seals the payload so the plaintext never appears on the wire", async () => {
      const alert = await prepareAlert(groups);

      expect(alert.ciphertext.startsWith("RN1.")).toBe(true);
      expect(alert.ciphertext).not.toContain("Please help");
      expect(alert.ciphertext).not.toContain("15551234567");
      expect(alert.staged).toBe(false);
    });

    it("produces a key separate from the ciphertext", async () => {
      const alert = await prepareAlert(groups);

      // The key is withheld until fire, which is what keeps a staged payload
      // unreadable while the user is still deciding.
      expect(alert.key).toBeTruthy();
      expect(alert.ciphertext).not.toContain(alert.key);
    });
  });

  describe("stageAlert", () => {
    it("marks the alert staged on success", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 202 });

      const alert = await prepareAlert(groups);
      expect(await stageAlert(alert)).toBe(true);
      expect(alert.staged).toBe(true);
    });

    it("does not throw when the network is unavailable", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

      const alert = await prepareAlert(groups);
      expect(await stageAlert(alert)).toBe(false);
      expect(alert.staged).toBe(false);
    });

    it("does not retry a 4xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

      await stageAlert(await prepareAlert(groups));
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("fireAlert", () => {
    const okResponse = {
      ok: true,
      status: 202,
      json: async () => ({ created: 1, deduped: 0 }),
    };

    it("omits the ciphertext once the payload is staged", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(okResponse);

      const alert = await prepareAlert(groups);
      alert.staged = true;

      await fireAlert(alert, { lat: 1, lng: 2 });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.key).toBeTruthy();
      expect(body.ciphertext).toBeUndefined();
    });

    it("sends the payload inline when staging did not complete", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(okResponse);

      const alert = await prepareAlert(groups);
      await fireAlert(alert, null);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.ciphertext).toBe(alert.ciphertext);
    });

    it("reports unreachable after exhausting retries", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("timeout"));

      const outcome = await fireAlert(await prepareAlert(groups), null);

      expect(outcome).toEqual({ ok: false, reason: "unreachable" });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("retries a transient failure and succeeds", async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue(okResponse);

      const outcome = await fireAlert(await prepareAlert(groups), null);
      expect(outcome).toEqual({ ok: true, created: 1, deduped: 0 });
    });

    it("does not retry a 4xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

      const outcome = await fireAlert(await prepareAlert(groups), null);

      expect(outcome).toEqual({ ok: false, reason: "rejected" });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("resends inline when the staged payload has expired", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 409 })
        .mockResolvedValue(okResponse);

      const alert = await prepareAlert(groups);
      alert.staged = true;

      const outcome = await fireAlert(alert, null);

      expect(outcome.ok).toBe(true);
      const second = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      expect(second.ciphertext).toBe(alert.ciphertext);
    });

    it("reports unconfigured rather than hanging when no credential exists", async () => {
      (getDeviceCredential as jest.Mock).mockResolvedValue(null);

      const outcome = await fireAlert(await prepareAlert(groups), null);

      expect(outcome).toEqual({ ok: false, reason: "unconfigured" });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("bounds every request with an abort signal", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(okResponse);

      await fireAlert(await prepareAlert(groups), null);

      // React Native's fetch has no default timeout; without this an alert can
      // hang for a minute while the phone is being taken.
      expect((global.fetch as jest.Mock).mock.calls[0][1].signal).toBeDefined();
    });
  });

  describe("cancelAlert", () => {
    it("discards a staged payload", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const alert = await prepareAlert(groups);
      alert.staged = true;
      await cancelAlert(alert);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).toMatchObject({ action: "cancel", alertId: alert.alertId });
    });

    it("does nothing when there is no staged payload", async () => {
      await cancelAlert(await prepareAlert(groups));
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("never throws", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

      const alert = await prepareAlert(groups);
      alert.staged = true;

      await expect(cancelAlert(alert)).resolves.toBeUndefined();
    });
  });
});
