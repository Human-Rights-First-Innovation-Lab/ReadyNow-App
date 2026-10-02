# Security Policy

ReadyNow is used by people who may be at immediate legal or physical risk. A
vulnerability here can expose someone's location, contacts, immigration status
or emergency plan. We take reports seriously and we would rather hear about a
problem early and informally than not at all.

## Reporting a vulnerability

**Email <innovationlab@humanrightsfirst.org>.**

Please do **not** open a public GitHub issue, pull request or discussion for a
security problem. A public report tells everyone — including people who might
act on it — before we have a fix out to users.

You can also use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository if you prefer to keep everything on GitHub.

### What to include

Whatever you have is better than nothing, but the most useful reports contain:

- What the problem is and what an attacker could do with it
- The steps, request, or code path needed to reproduce it
- The version, branch or commit you tested
- The platform (iOS / Android) and OS version, if relevant
- Whether you believe it is already being exploited

If writing it up carefully would delay you, send the short version first.

### What to expect

| | |
| --- | --- |
| First response | Within 3 business days |
| Assessment and severity | Within 10 business days |
| Fix or mitigation plan | Communicated with the assessment |

We will keep you updated as we work, tell you when a fix ships, and credit you
in the release notes and advisory unless you would rather stay anonymous. If we
decide something is not a vulnerability, we will explain why rather than just
closing the thread.

## Scope

**In scope** — this repository: the React Native / Expo application, the Twilio
Functions under `twilio/`, the build and CI configuration, and the deployed
ReadyNow app.

**Out of scope** — third-party services we use but do not operate (Auth0,
Twilio, Firebase, Sentry). Report those to the vendor. Also out of scope:
findings that require a rooted or jailbroken device with an attacker already
present, and reports produced solely by a scanner with no demonstrated impact.

### Known and accepted

One item is already known, so please do not spend your time on it:

- **Sensitive operations proceed without a prompt on a device that has no lock
  screen configured at all.** Where any lock exists — biometric, PIN, pattern
  or password — it is required. Where none exists there is no credential to
  check against, and anyone holding the device already has access to
  everything on it.

Some parts of the Twilio backend are mid-migration, and a few behaviours there
are known trade-offs we are already tracking rather than oversights. Report
anything you find in the normal way and we will tell you if it is one of them
— please do not assume, and please do not open a public issue to ask.

## Safe harbour

We will not pursue or support legal action against anyone who acts in good
faith under this policy: research your own accounts and test data, avoid
privacy violations and service disruption, do not access or modify other
people's data, and give us reasonable time to fix things before going public.

If you are unsure whether something is in bounds, email us and ask first.

## Disclosure

We prefer coordinated disclosure. Our default is to publish an advisory once a
fix is available to users, which for a mobile app means after the app store
release has actually rolled out — usually longer than a server-side fix would
take. If a problem is being actively exploited we will move faster and may ship
a mitigation before a full fix.
