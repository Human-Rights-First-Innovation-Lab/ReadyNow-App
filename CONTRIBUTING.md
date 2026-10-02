# Contributing to ReadyNow

Thanks for your interest in ReadyNow.

ReadyNow is an emergency alert app for people facing immigration enforcement.
Its users are often in genuine danger, may be using an old or borrowed phone,
and may not read English. That shapes what "good" means here: reliability,
clarity and privacy matter more than features, and a change that makes the app
faster but less predictable in an emergency is not an improvement.

Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

**If you use ReadyNow and need help with the app**, this is the wrong document
— see [SUPPORT.md](SUPPORT.md). Please don't open a GitHub issue about your own
account, plan or contacts; issues here are public and permanent.

**New to the project?** [docs/good-first-contributions.md](docs/good-first-contributions.md)
is the practical walkthrough: what we label, where to start, and a first PR
start to finish.

## Security issues

**Do not open an issue or pull request for a security vulnerability.** See
[SECURITY.md](SECURITY.md) — email <innovationlab@humanrightsfirst.org>.

## Reporting a bug or suggesting a change

Use the [issue templates](https://github.com/Human-Rights-First-Innovation-Lab/readynow/issues/new/choose).
There are three: a bug report, a feature request, and a translation
correction. Blank issues are turned off, because the templates ask the
questions we would otherwise have to come back for.

One rule applies to all of them: **an issue is public and permanent.** Never
include real phone numbers, contact names, addresses, A-Numbers, immigration
status, or screenshots of a real emergency plan. Redact freely — a report with
`+1 555-0100` in place of a real number is just as useful to us. If a bug
cannot be described without sensitive detail, email it instead.

## Getting set up

You will need Node 20 (CI runs 20.x) and the Expo tooling.

```bash
npm ci
cp app/google-services.json.template app/google-services.json
npm start
```

`app/google-services.json` is not in the repository — it holds a live Firebase
key. The template gets you a working build; for push notifications against our
Firebase project, ask the maintainers. Environment variables are documented in
`types/env.d.ts`.

Full setup, including emulators, is in the [README](README.md).

## Before you open a pull request

```bash
npm run type-check     # must be clean
npm run test:coverage  # 719 tests across 31 suites
npm run lint
```

Note that `npm test` runs Jest in watch mode and will not exit; use
`npm run test:coverage` for a single run. Coverage is compared against
`.github/coverage-baseline.json` in CI and is not allowed to regress.

## How we work

**Branches** follow `<author>/<type>/<short-description>`, for example
`jason/feature/open_source_prep` or `jrj/bugfix/layout-issue-for-big-texts`.

**Commits** follow [Conventional Commits](https://www.conventionalcommits.org):
`feat(alerts):`, `fix(security):`, `chore(deps):`, `docs:`. Write the body to
explain *why*, not what — the diff already says what.

**Every commit must be signed off** with `git commit -s`, which appends a
`Signed-off-by:` line certifying you have the right to submit the work. CI
checks this on every pull request and will fail if a commit is missing it. See
[Licensing of contributions](#licensing-of-contributions) below and
[DCO.md](DCO.md), which explains how to fix it if you forget.

**Pull requests** should target `develop`, not `main`. Keep them focused; a PR
that fixes one thing gets reviewed quickly, and one that fixes five gets
stalled. Describe how you tested on a real device or emulator, and say which
platform.

## Who maintains this, and what to expect

ReadyNow is maintained by the **Human Rights First Innovation Lab**. Outside
contributions are genuinely welcome, and the maintainers make the final call on
what merges — there is no formal voting process, and this is not a
community-governed project.

Practically, that means:

- **A first response within about a week.** This is a small team at a nonprofit.
  A quiet pull request is not a rejected one; if a fortnight goes by with
  nothing, it is reasonable to comment on the thread or email us.
- **Close review.** Expect change requests. This app is used where a subtle bug
  has real consequences, so review here is stricter than you may be used to. It
  isn't a judgement on your work. If a request doesn't make sense, push back —
  reviewers are sometimes wrong.
- **We may say no.** Sometimes for a reason that isn't visible in the codebase:
  a commitment to a partner organisation, a legal constraint, or something we
  know about how the app is actually used in the field. When that happens we
  will tell you why rather than letting it go quiet.
- **Ask first for anything substantial.** Open an issue or email
  <innovationlab@humanrightsfirst.org> before building something large. It
  saves everyone the disappointment of a big PR that does not fit.

Certain paths require a maintainer's review before merging; those are listed in
[.github/CODEOWNERS](.github/CODEOWNERS) and explained below.

## What we especially want help with

- **Translations.** The app ships nine languages: English, Spanish, Korean,
  French, Haitian Creole, Chinese, Arabic, Dari and Pashto. Translation files
  are in `app/translations/`. If you are a fluent speaker, reviewing existing
  strings for accuracy and tone is genuinely valuable — some were
  machine-translated and are marked for review in
  [docs/translation-review.md](docs/translation-review.md). You do not need to
  write code: opening a translation-correction issue is a real contribution.
- **Accessibility**, especially large font sizes and screen readers.
- **Testing on older and low-end Android devices.**

## Deliberately out of scope

- **International phone numbers.** ReadyNow addresses the US immigration
  situation, and assumes anyone a user needs to reach is in the US. The
  ten-digit inputs and the `+1` default are the product's scope, not an
  oversight — please don't submit country-code support. See
  `docs/international-phone-numbers.md`.
- **Over-the-air updates.** Considered and declined; a prolonged app load is
  not an acceptable trade on a screen that has to work in an emergency.

## Things to know before changing certain areas

Some parts of this codebase have non-obvious constraints. Please ask before
reworking them:

- **`twilio/`** — these Functions run against production and handle real phone
  numbers. The older endpoints must not be removed or have their request
  formats changed: their URLs are compiled into app bundles already on users'
  phones, and the app has no over-the-air update mechanism, so a change here
  breaks people who cannot update. Ask before touching anything in this
  directory.
- **Encryption** (`app/utils/encryption-utils.ts`) — uses authenticated
  encryption via `@noble/ciphers`. There is deliberately no plaintext fallback:
  a failure to encrypt must fail, not silently save readable data.
- **Crash reporting** (`app/utils/crash-reporting.ts`) — opt-in, with all
  personal data scrubbed. Please do not add fields without discussing it.
- **The alert send path** — must never report success on a failed send.

## Licensing of contributions

ReadyNow is licensed under [Apache License 2.0](LICENSE). By contributing, you
agree that your contributions are licensed under the same terms, including the
patent grant in section 3.

We use the **Developer Certificate of Origin** rather than a contributor
license agreement — there is nothing to sign. You certify the origin of your
work by signing off each commit:

```bash
git commit -s -m "fix(plan): keep the delete confirmation readable at 200% font size"
```

That appends `Signed-off-by: Your Name <you@example.com>` using your git
config. The `DCO Sign-off` CI job verifies it on every pull request.
[DCO.md](DCO.md) has the full certificate, how to set your identity, and how to
add a missing sign-off to commits you have already made.

If you are contributing as part of your job, your employer may own the
copyright in your work — make sure you have their permission before signing
off.

## Questions

Open a discussion or issue, or email <innovationlab@humanrightsfirst.org>. If
you are working on something substantial, ask first — it saves everyone the
disappointment of a large PR that does not fit.
