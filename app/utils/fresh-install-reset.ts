import * as SecureStore from "expo-secure-store";

import {
  STORAGE_KEYS,
  clearLocalSession,
  revokeRefreshTokenBestEffort,
} from "./auth-service";
import { clearDeviceCredential } from "./device-credential";
import {
  clearAdditionalLegalHelp,
  resetEmergencyPlanData,
} from "./storage-utils";

/**
 * Run a reset step without letting its failure stop the ones after it.
 *
 * A partial wipe beats a wipe that aborts on its first error, on a handset
 * that is about to be seized.
 */
const step = async (name: string, run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    console.error(
      `Fresh-install reset step "${name}" failed:`,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * Remove everything an officer could read off the handset.
 *
 * Runs the moment an alert has been handed off, success or failure alike, and
 * is never gated on the user dismissing anything - the phone may be taken
 * first. That includes the alert credential: a seized device must not be able
 * to send again in the user's name.
 */
export const wipeDeviceData = async (): Promise<void> => {
  await step("additional legal help", clearAdditionalLegalHelp);
  await step("emergency plan", resetEmergencyPlanData);
  await step("device credential", clearDeviceCredential);
  await step("push registration flag", () =>
    SecureStore.deleteItemAsync("push_notification_registered")
  );
};

/**
 * End the Auth0 session and return the app to its pre-onboarding routing.
 *
 * Deliberately separate from wipeDeviceData, and deliberately later. The data
 * has to go immediately; the session does not, and signing someone out
 * mid-sentence - while they are still reading what just happened, or telling
 * us the press was accidental - makes the app feel like it has abandoned them
 * at the worst moment. The caller decides when.
 *
 * Nothing here blocks on the network: the session is cleared locally and
 * revocation is left to finish on its own.
 */
export const endSession = async (): Promise<void> => {
  let refreshToken: string | null = null;

  await step("auth session", async () => {
    refreshToken = await clearLocalSession();
  });

  // Cleared with the session rather than with the data, so the app never sits
  // in the contradictory state of signed-in-but-not-onboarded.
  await step("onboarding flag", () =>
    SecureStore.deleteItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED)
  );

  if (refreshToken) {
    void revokeRefreshTokenBestEffort(refreshToken);
  }
};

/**
 * Both halves, for a caller that wants the whole reset at once.
 */
export const resetToFreshInstall = async (): Promise<void> => {
  await wipeDeviceData();
  await endSession();
};

export default { wipeDeviceData, endSession, resetToFreshInstall };
