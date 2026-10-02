import * as SecureStore from "expo-secure-store";

import {
  endSession,
  resetToFreshInstall,
  wipeDeviceData,
} from "../fresh-install-reset";
import { clearLocalSession, revokeRefreshTokenBestEffort } from "../auth-service";
import { clearDeviceCredential } from "../device-credential";
import {
  clearAdditionalLegalHelp,
  resetEmergencyPlanData,
} from "../storage-utils";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../auth-service", () => ({
  STORAGE_KEYS: { ONBOARDING_COMPLETED: "hasCompletedOnboarding" },
  clearLocalSession: jest.fn().mockResolvedValue(null),
  revokeRefreshTokenBestEffort: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../device-credential", () => ({
  clearDeviceCredential: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../storage-utils", () => ({
  clearAdditionalLegalHelp: jest.fn().mockResolvedValue(undefined),
  resetEmergencyPlanData: jest.fn().mockResolvedValue(undefined),
}));

const deleted = () =>
  (SecureStore.deleteItemAsync as jest.Mock).mock.calls.map(([k]) => k);

describe("wipeDeviceData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it("clears the plan, contacts and the alert credential", async () => {
    await wipeDeviceData();
    expect(clearAdditionalLegalHelp).toHaveBeenCalled();
    expect(resetEmergencyPlanData).toHaveBeenCalled();
    expect(clearDeviceCredential).toHaveBeenCalled();
    expect(deleted()).toContain("push_notification_registered");
  });

  /**
   * The data goes immediately; the session is the caller's business and must
   * survive this call, or the user is signed out mid-modal.
   */
  it("leaves the session alone", async () => {
    await wipeDeviceData();
    expect(clearLocalSession).not.toHaveBeenCalled();
    expect(deleted()).not.toContain("hasCompletedOnboarding");
  });

  it("keeps going when a step throws", async () => {
    (resetEmergencyPlanData as jest.Mock).mockRejectedValueOnce(
      new Error("keychain unavailable")
    );
    await expect(wipeDeviceData()).resolves.toBeUndefined();
    expect(clearDeviceCredential).toHaveBeenCalled();
  });
});

describe("endSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (clearLocalSession as jest.Mock).mockResolvedValue(null);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it("clears the session and the onboarding flag", async () => {
    await endSession();
    expect(clearLocalSession).toHaveBeenCalled();
    expect(deleted()).toContain("hasCompletedOnboarding");
  });

  it("does not touch the plan or the credential", async () => {
    await endSession();
    expect(resetEmergencyPlanData).not.toHaveBeenCalled();
    expect(clearDeviceCredential).not.toHaveBeenCalled();
  });
});

describe("resetToFreshInstall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (clearLocalSession as jest.Mock).mockResolvedValue(null);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it("clears the plan, the credential and the session", async () => {
    await resetToFreshInstall();

    expect(clearAdditionalLegalHelp).toHaveBeenCalled();
    expect(resetEmergencyPlanData).toHaveBeenCalled();
    expect(clearDeviceCredential).toHaveBeenCalled();
    expect(clearLocalSession).toHaveBeenCalled();
  });

  it("clears onboarding so the app routes back to the welcome flow", async () => {
    await resetToFreshInstall();
    expect(deleted()).toContain("hasCompletedOnboarding");
  });

  it("clears the push registration flag", async () => {
    await resetToFreshInstall();
    expect(deleted()).toContain("push_notification_registered");
  });

  /**
   * The point of the per-step guard. A device that fails one delete must still
   * have everything else removed - a partial wipe beats a wipe that stops at
   * its first error, on a handset that is about to be seized.
   */
  it("keeps going when a step throws", async () => {
    (resetEmergencyPlanData as jest.Mock).mockRejectedValueOnce(
      new Error("keychain unavailable")
    );

    await expect(resetToFreshInstall()).resolves.toBeUndefined();

    expect(clearDeviceCredential).toHaveBeenCalled();
    expect(clearLocalSession).toHaveBeenCalled();
    expect(deleted()).toContain("hasCompletedOnboarding");
  });

  it("still clears the session when the credential wipe fails", async () => {
    (clearDeviceCredential as jest.Mock).mockRejectedValueOnce(
      new Error("no such item")
    );

    await resetToFreshInstall();

    expect(clearLocalSession).toHaveBeenCalled();
  });

  it("revokes the refresh token without waiting on the network", async () => {
    let settle: (() => void) | undefined;
    (revokeRefreshTokenBestEffort as jest.Mock).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        settle = resolve;
      })
    );
    (clearLocalSession as jest.Mock).mockResolvedValueOnce("refresh-token");

    // Resolves even though revocation is still in flight.
    await expect(resetToFreshInstall()).resolves.toBeUndefined();
    expect(revokeRefreshTokenBestEffort).toHaveBeenCalledWith("refresh-token");

    settle?.();
  });

  it("does not attempt revocation when there was no refresh token", async () => {
    (clearLocalSession as jest.Mock).mockResolvedValueOnce(null);
    await resetToFreshInstall();
    expect(revokeRefreshTokenBestEffort).not.toHaveBeenCalled();
  });
});
