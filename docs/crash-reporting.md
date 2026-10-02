# Crash Reporting

ReadyNow uses [Sentry](https://sentry.io) to report crashes. Because the app is
used by people preparing for immigration detention, crash reporting is treated
as a privacy-sensitive subsystem rather than routine telemetry.

Two rules govern it:

1. **Opt-in.** Sentry is not initialized until the user explicitly agrees. No
   consent means no client, no session, and no network request to Sentry.
2. **No personal data.** Nothing that identifies a person is included in an
   event.

Implementation: [`app/utils/crash-reporting.ts`](../app/utils/crash-reporting.ts).

## Consent

Consent is stored in SecureStore under `crash_reporting_consent`, with three
states: `granted`, `denied`, and `unset`.

- The prompt is shown once, immediately after account creation, by
  [`app/screens/welcome/crash-reporting.tsx`](../app/screens/welcome/crash-reporting.tsx).
  It sits between OTP verification and wherever the user was headed, forwarding
  to that destination via a `next` param, so no existing navigation branch
  changes.
- The choice can be changed at any time in Settings. Withdrawing consent calls
  `Sentry.close()`.
- Consent is read **synchronously** at startup. An async read would leave a
  window in which the SDK could open a session for someone who never agreed.
- Reads fail closed: if SecureStore is unavailable, consent is treated as unset.

## What is sent

| Included | Excluded |
| --- | --- |
| Exception type, message, stack trace | Name, phone number, email address |
| Device model, family, architecture | A-Number, date of birth, country of birth |
| OS name and version | Emergency plan contents, messages, contacts |
| App version and build | Location, IP address |
| Navigation breadcrumbs | Locale, timezone, per-install identifier |

## How that is enforced

`scrubEvent` is installed as `beforeSend`. The SDK runs `beforeSend` **after**
every event processor, which matters: `deviceContextIntegration` injects
`event.user` and `event.extra` from the **native** layer, so simply never
calling `Sentry.setUser` is not sufficient. `beforeSend` is the last gate before
an event is serialized, and it:

- deletes `user`, `extra`, `request`, and `server_name` outright;
- reduces `contexts.device` and `contexts.app` to an **allowlist**, so a future
  SDK version that adds a field cannot start leaking it silently. `device.name`
  (often "<Name>'s iPhone"), `device_app_hash`, and `contexts.culture` (locale
  and timezone, which narrow down location) are all dropped;
- runs a redaction pass over free text — the event message, exception values,
  and breadcrumb messages — replacing anything matching an email address, a
  phone number, or a run of 8+ digits (which covers A-Numbers) with
  `[redacted]`. This is defence against a developer interpolating user data into
  an error message;
- drops console breadcrumbs and all breadcrumb `data`.

Other configuration:

- `sendDefaultPii: false` — sets `infer_ip: 'never'`, so Sentry's ingest does
  not resolve or store the client IP, and no IP is attached to sessions.
- `breadcrumbsIntegration({ console: false })` — console output is **not**
  captured. This overrides the default instance, which has `console: true`.
  Note this is not controlled by `enableLogs`; disabling logs alone would leave
  console breadcrumbs on.
- `enableLogs: false` — nothing writes to Sentry's log channel.
- No session replay. Replay would screenshot screens showing A-Numbers, dates of
  birth, attorney details and family contacts.

## Required Sentry project settings

Two things cannot be enforced from the client and **must** be configured in the
Sentry project:

1. **Prevent Storing of IP Addresses** (Settings → Security & Privacy). The
   client sets `infer_ip: 'never'`, but that flag rides in JS envelope metadata.
   Events written by the **native** crash handler — a hard crash is captured
   natively and sent on next launch — do not pass through the JS `beforeSend`,
   so the project-level setting is what covers them.
2. **Data Scrubber** and **Use Default Scrubbers** should remain enabled as a
   backstop.

Until (1) is enabled, native crash reports may have an IP recorded against them.

## Residual risk

- **Network-level IP.** Sending anything to Sentry means opening an HTTPS
  connection, and the receiving server necessarily observes the source IP. That
  is inherent to any third-party service, not specific to Sentry. It is
  mitigated by opt-in — if the user declines, no connection is ever made — and
  by the project setting above, which stops the IP from being recorded.
- **Native crash events** bypass the JS `beforeSend`. They carry native device
  context and an anonymous per-install identifier. If that is unacceptable, set
  `enableNativeCrashHandling: false`, accepting the loss of visibility into hard
  crashes.

## Changing this code

If you add a `Sentry.captureException` call, do **not** attach a response body,
request payload, or anything derived from user input via `extra`. `beforeSend`
strips `extra` wholesale, so it would be silently dropped anyway — but the
review habit matters more than the backstop.

`app/utils/__tests__/crash-reporting.test.ts` asserts these properties directly,
including a realistic event checked against a list of values that must never
appear in a serialized payload. Extend it when you change the scrubber.
