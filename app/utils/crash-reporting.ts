import * as Sentry from "@sentry/react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Crash reporting (Sentry) — consent-gated and stripped of personal data.
 *
 * ReadyNow is used by people preparing for immigration detention. A crash
 * report that carries an IP address, a phone number or an A-number is a record
 * about someone's fear of enforcement held by a third party, so this module
 * enforces two rules:
 *
 *  1. Sentry is not initialized at all until the user explicitly opts in.
 *     No consent means no client, no session, and no network request.
 *  2. Nothing that identifies a person leaves the device. `scrubEvent` runs as
 *     `beforeSend`, which the SDK applies *after* every event processor
 *     (including the native device-context integration, which injects
 *     `event.user` and `event.extra` from the native layer), so it is the last
 *     gate before an event is serialized.
 *
 * See docs/crash-reporting.md for the residual risks that code alone cannot
 * close, in particular the Sentry project setting that must be enabled.
 */

const CONSENT_KEY = "crash_reporting_consent";

export type CrashReportingConsent = "granted" | "denied" | "unset";

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * Read consent synchronously.
 *
 * Synchronous on purpose: this is read at module load before Sentry is
 * initialized, and an async read would leave a window in which the SDK could
 * start a session for a user who never agreed to one.
 */
export const getCrashReportingConsent = (): CrashReportingConsent => {
  try {
    const stored = SecureStore.getItem(CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : "unset";
  } catch (error) {
    // Fail closed: if we cannot confirm consent, assume it was not given.
    console.error(
      "Could not read crash reporting consent:",
      error instanceof Error ? error.message : String(error)
    );
    return "unset";
  }
};

/** Record the user's choice and start or stop crash reporting to match. */
export const setCrashReportingConsent = async (granted: boolean): Promise<void> => {
  await SecureStore.setItemAsync(CONSENT_KEY, granted ? "granted" : "denied");

  if (granted) {
    initializeCrashReporting();
  } else {
    await disableCrashReporting();
  }
};

/** True once the user has answered the prompt either way. */
export const hasAnsweredCrashReportingPrompt = (): boolean =>
  getCrashReportingConsent() !== "unset";

// ---------------------------------------------------------------------------
// Scrubbing
// ---------------------------------------------------------------------------

// Device fields that are safe to keep: they describe the hardware, not the
// person. An allowlist rather than a denylist, so a future SDK version adding
// a new field cannot start leaking it silently.
const ALLOWED_DEVICE_FIELDS = [
  "family",
  "model",
  "model_id",
  "arch",
  "simulator",
  "processor_count",
  "memory_size",
] as const;

// Bundle/version data is identical across all installs; device_app_hash is a
// stable per-install identifier and is deliberately not included.
const ALLOWED_APP_FIELDS = [
  "app_identifier",
  "app_name",
  "app_version",
  "app_build",
  "in_foreground",
] as const;

const REDACTED = "[redacted]";

// Applied to free-text fields only (messages, exception values, breadcrumbs),
// never to the whole event, so timestamps and ids stay intact.
const REDACTION_PATTERNS: [RegExp, string][] = [
  // Email addresses
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  // Phone numbers in E.164 or common punctuated forms
  [/\+?\d[\d\s()./-]{7,}\d/g, REDACTED],
  // Bare digit runs of 8+, which covers A-numbers and raw phone numbers
  [/\b\d{8,}\b/g, REDACTED],
];

/** Redact anything in a free-text string that could identify a person. */
export const redactFreeText = (value: string): string =>
  REDACTION_PATTERNS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    value
  );

const pick = <T extends object>(source: T, keys: readonly string[]): Partial<T> => {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) {
      result[key] = (source as Record<string, unknown>)[key];
    }
  }
  return result as Partial<T>;
};

/**
 * Strip every personal identifier from an event.
 *
 * Exported for testing: this is the guarantee the rest of the app depends on,
 * so it is asserted directly rather than only through Sentry.
 */
export const scrubEvent = (event: Sentry.ErrorEvent): Sentry.ErrorEvent => {
  // Identity and free-form payloads. `user` is re-added by the native device
  // context integration even though we never call setUser, so deleting it here
  // rather than merely avoiding setUser is what actually removes it.
  delete event.user;
  delete event.extra;
  delete event.request;
  delete event.server_name;

  // Contexts: keep only hardware/app facts, drop everything else (culture
  // carries locale and timezone, which narrow down where someone is).
  if (event.contexts) {
    const { device, app, os, runtime } = event.contexts;
    event.contexts = {
      ...(device ? { device: pick(device, ALLOWED_DEVICE_FIELDS) } : {}),
      ...(app ? { app: pick(app, ALLOWED_APP_FIELDS) } : {}),
      ...(os ? { os } : {}),
      ...(runtime ? { runtime } : {}),
    };
  }

  // Free text that a developer may have interpolated user data into
  if (event.message) {
    event.message = redactFreeText(event.message);
  }

  if (event.exception?.values) {
    for (const exceptionValue of event.exception.values) {
      if (exceptionValue.value) {
        exceptionValue.value = redactFreeText(exceptionValue.value);
      }
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      // Console breadcrumbs are disabled at the integration level; this is a
      // second line of defence in case that configuration regresses.
      .filter((crumb) => crumb.category !== "console")
      .map((crumb) => ({
        ...crumb,
        message: crumb.message ? redactFreeText(crumb.message) : crumb.message,
        data: undefined,
      }));
  }

  return event;
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialize Sentry. Safe to call more than once; subsequent calls are no-ops.
 *
 * Only ever called once consent is "granted".
 */
export const initializeCrashReporting = (): void => {
  if (Sentry.getClient()) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",

    // Prevents Sentry's ingest from inferring and storing the client IP
    // (sets infer_ip: 'never' and skips attaching an IP to sessions).
    sendDefaultPii: false,

    // Nothing in the app writes to Sentry's log channel.
    enableLogs: false,

    // Session replay would screenshot screens showing A-numbers, dates of
    // birth, attorney details and family contacts. It stays off. Re-enabling
    // it requires masking configuration (maskAllText, maskAllImages) and a
    // fresh privacy review - do not simply add mobileReplayIntegration() back.

    integrations: [
      // Overrides the default instance, which captures console output as
      // breadcrumbs. User-supplied integrations are appended after defaults
      // and win on name collision.
      Sentry.breadcrumbsIntegration({ console: false }),
    ],

    beforeSend: scrubEvent,
  });
};

/** Stop crash reporting after the user withdraws consent. */
export const disableCrashReporting = async (): Promise<void> => {
  const client = Sentry.getClient();
  if (!client) return;

  try {
    await Sentry.close();
  } catch (error) {
    console.error(
      "Could not shut down crash reporting:",
      error instanceof Error ? error.message : String(error)
    );
  }
};

/** Called at startup: start crash reporting only if consent was already given. */
export const initializeCrashReportingIfConsented = (): void => {
  if (getCrashReportingConsent() === "granted") {
    initializeCrashReporting();
  }
};

export default {
  getCrashReportingConsent,
  setCrashReportingConsent,
  hasAnsweredCrashReportingPrompt,
  initializeCrashReporting,
  initializeCrashReportingIfConsented,
  disableCrashReporting,
  scrubEvent,
};
