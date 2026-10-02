import * as Crypto from "expo-crypto";

import { sealWithEphemeralKey } from "../utils/encryption-utils";
import { getDeviceCredential } from "../utils/device-credential";
import { generateSecureUUID } from "../utils/secureRandom";

/**
 * Client for the emergency alert endpoint. See ALERT-DELIVERY-DESIGN.md.
 *
 * The shape here follows one rule: the device wipes on confirmed **handoff**,
 * not on confirmed **delivery**. So these calls exist to get the payload off
 * the device as fast and as reliably as possible, and to report honestly
 * whether that succeeded. Delivery itself is no longer the client's problem.
 *
 * Every request is bounded by an AbortController. React Native's fetch has no
 * default timeout, so an unbounded call can hang for a minute while the user
 * watches a spinner and their phone is taken.
 */

export interface AlertContact {
  name: string;
  phoneNumber: string;
}

export interface AlertGroup {
  body: string;
  to: string[];
  names: string[];
}

export interface AlertPayload {
  v: 1;
  groups: AlertGroup[];
}

export interface AlertLocation {
  lat: number;
  lng: number;
}

/** What the client holds between staging and firing one alert. */
export interface PreparedAlert {
  alertId: string;
  key: string;
  ciphertext: string;
  planHash: string;
  staged: boolean;
}

export type FireOutcome =
  | { ok: true; created: number; deduped: number }
  | { ok: false; reason: "unreachable" | "rejected" | "unconfigured" };

const STAGE_TIMEOUT_MS = 5000;
const STAGE_ATTEMPTS = 2;

const FIRE_TIMEOUT_MS = 4000;
const FIRE_ATTEMPTS = 3;
const FIRE_BACKOFF_MS = [0, 1000, 2000];

const endpoint = (): string | undefined => process.env.EXPO_PUBLIC_ALERT_URL;

const request = async (
  body: unknown,
  timeoutMs: number
): Promise<Response | null> => {
  const url = endpoint();
  if (!url) return null;

  const credential = await getDeviceCredential();
  if (!credential) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Build the wire payload and encrypt it.
 *
 * Distinct parts are sent once and composed server-side rather than expanding
 * every message here: the staged blob is what has to cross a bad network under
 * duress, so its size matters.
 */
export const prepareAlert = async (
  groups: AlertGroup[]
): Promise<PreparedAlert> => {
  const payload: AlertPayload = { v: 1, groups };
  const plaintext = JSON.stringify(payload);

  const planHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    plaintext
  );

  // Sealed under a one-off key held only in memory and handed over at fire
  // time, so nothing readable exists remotely before the user commits.
  const { ciphertext, key } = await sealWithEphemeralKey(plaintext);

  return {
    alertId: generateSecureUUID(),
    key,
    ciphertext,
    planHash,
    staged: false,
  };
};

/**
 * Upload the encrypted payload during the button's countdown.
 *
 * Best-effort: a failure here is not fatal, because fire() falls back to
 * sending the payload inline. Never throws.
 */
export const stageAlert = async (alert: PreparedAlert): Promise<boolean> => {
  for (let attempt = 0; attempt < STAGE_ATTEMPTS; attempt++) {
    try {
      const response = await request(
        {
          action: "stage",
          alertId: alert.alertId,
          ciphertext: alert.ciphertext,
          planHash: alert.planHash,
        },
        STAGE_TIMEOUT_MS
      );

      if (response && response.ok) {
        alert.staged = true;
        return true;
      }

      // A 4xx will not improve on retry.
      if (response && response.status >= 400 && response.status < 500) {
        return false;
      }
    } catch {
      // Timed out or offline; fall through to the next attempt.
    }
  }

  return false;
};

/**
 * Commit the alert.
 *
 * Sends the decryption key plus, if staging never completed, the payload
 * inline. Retries a few times within a bounded budget - the user is standing
 * there, and a phone may be taken at any moment.
 */
export const fireAlert = async (
  alert: PreparedAlert,
  location: AlertLocation | null
): Promise<FireOutcome> => {
  if (!endpoint()) return { ok: false, reason: "unconfigured" };
  if (!(await getDeviceCredential())) return { ok: false, reason: "unconfigured" };

  const body = {
    action: "fire",
    alertId: alert.alertId,
    key: alert.key,
    location,
    // Omitted when staging succeeded, which is what keeps this request small.
    ...(alert.staged ? {} : { ciphertext: alert.ciphertext, planHash: alert.planHash }),
  };

  for (let attempt = 0; attempt < FIRE_ATTEMPTS; attempt++) {
    if (FIRE_BACKOFF_MS[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, FIRE_BACKOFF_MS[attempt]));
    }

    try {
      const response = await request(body, FIRE_TIMEOUT_MS);
      if (!response) return { ok: false, reason: "unconfigured" };

      if (response.ok) {
        const result = (await response.json()) as {
          created?: number;
          deduped?: number;
        };
        return {
          ok: true,
          created: result.created ?? 0,
          deduped: result.deduped ?? 0,
        };
      }

      // 409 means the staged payload is gone; resend it inline and try again.
      if (response.status === 409 && alert.staged) {
        alert.staged = false;
        return fireAlert(alert, location);
      }

      if (response.status >= 400 && response.status < 500) {
        return { ok: false, reason: "rejected" };
      }
    } catch {
      // Timed out or offline; retry within the budget.
    }
  }

  return { ok: false, reason: "unreachable" };
};

/**
 * Discard a staged payload the user backed out of. Fire-and-forget: the
 * staged blob is unreadable without the key and expires on its own, so a
 * failure here costs nothing.
 */
export const cancelAlert = async (alert: PreparedAlert): Promise<void> => {
  if (!alert.staged) return;

  try {
    await request({ action: "cancel", alertId: alert.alertId }, STAGE_TIMEOUT_MS);
  } catch {
    // Deliberately ignored.
  }
};

export default { prepareAlert, stageAlert, fireAlert, cancelAlert };
