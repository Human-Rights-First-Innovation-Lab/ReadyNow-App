## What this changes and why

<!--
The diff says what changed. Use this space for why — the problem you hit, or
the behaviour a user was seeing. If it closes an issue, write "Closes #123".
-->

## How you tested it

<!--
Say what you actually ran it on. "Pixel 4a, Android 13, emulator" is a real
answer; "tested locally" is not. If you could only test one platform, say so —
that is fine, we will cover the other.
-->

- [ ] Ran on a device or emulator: <!-- device, OS version, iOS/Android -->
- [ ] `npm run type-check` is clean
- [ ] `npm run test:coverage` passes (coverage must not regress)
- [ ] `npm run lint` is clean

## Checklist

- [ ] Targets `develop`, not `main`
- [ ] Commits are signed off (`git commit -s`) — see [DCO.md](https://github.com/Human-Rights-First-Innovation-Lab/readynow/blob/develop/DCO.md)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
- [ ] No secrets, keys, real phone numbers or personal data in the diff
- [ ] Any new user-facing string is added to all nine languages in `app/translations/`

## Sensitive areas

<!--
Tick anything this PR touches. These have non-obvious constraints and need a
maintainer's review — see CONTRIBUTING.md. Ticking a box is not a problem, it
just routes the review.
-->

- [ ] `twilio/` — endpoint URLs are compiled into app bundles already on users' phones
- [ ] Encryption (`app/utils/encryption-utils.ts`)
- [ ] Crash reporting (`app/utils/crash-reporting.ts`)
- [ ] The alert send path
- [ ] None of the above

## Screenshots

<!-- For UI changes. Redact any personal data. Both platforms if you have them. -->

<details>
<summary>Show screenshots</summary>

</details>

## For maintainers

<!-- Internal tracking ticket, if there is one. Outside contributors: leave blank. -->

-
