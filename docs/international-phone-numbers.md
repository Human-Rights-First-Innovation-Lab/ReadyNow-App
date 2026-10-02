# Phone numbers are US-only, by decision

**Decided 2026-09-08: ReadyNow will not support international phone numbers.**

ReadyNow addresses the US immigration situation. The working assumption is that
anyone a user needs to reach — themselves at sign-in, and the emergency
contacts they nominate — is in the US, so country code handling is unnecessary
complexity in an app that has to be reliable under stress.

This file previously described the US-only limitation as an open defect and
listed what a fix would require. It is not a defect. It is the product's scope.

## What this means in the code

Five inputs strip non-digits and truncate to ten digits behind a
`(xxx)-xxx-xxxx` mask:

| File | Line | Screen |
| --- | --- | --- |
| `app/phone-auth.tsx` | 34 | Sign in |
| `app/screens/welcome/createaccount.tsx` | 48 | Create account |
| `app/screens/welcome/plan-import-option.tsx` | 65 | Import a plan |
| `app/components/LegalSupportForm.tsx` | 302 | Legal support intake |
| `app/components/MessageSetup.tsx` | 152 | Emergency contacts |

`formatPhoneNumberForAuth0` in `app/utils/auth-config.ts` defaults a bare
national number to `+1`. That default is correct under this decision.

The same function also handles numbers that already carry a country code, and
that behaviour is kept. It is not international support — no UI can produce
such a number — but it stops a latent bug: the function used to strip every
non-digit and prefix `+1` unconditionally, so `+1 212 555 0143` became
`+112125550143`. Covered by `app/utils/__tests__/auth-config.test.ts`.

Note that `+1` is the NANP code, which also covers Canada and much of the
Caribbean. A ten-digit Canadian number will work. That costs nothing and is
left alone.

## The one loose end

Under this decision the inputs are doing the right thing, but they do it
**silently**. Someone entering a non-US number has the extra digits truncated
without explanation, producing a wrong ten-digit number rather than an error.
In an app shipping nine languages, some users will try.

If that is worth closing, the fix is not international support — it is telling
the user, in their own language, that a US number is required. That is a small
validation-and-copy change across the five inputs above, plus nine
translations. It is not currently scheduled, and nothing is broken without it.
