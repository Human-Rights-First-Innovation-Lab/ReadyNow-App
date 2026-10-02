# Good first contributions

This is a guide for a first contribution to ReadyNow. It assumes you have read
[CONTRIBUTING.md](../CONTRIBUTING.md); this page is the practical version of
"where do I start".

## How we label issues

| Label | What it means |
| --- | --- |
| `good first issue` | Small, self-contained, and doesn't need context you'd only have from working on the app. A reviewer has confirmed it is genuinely small. |
| `help wanted` | We would like outside help. Not necessarily small. |
| `translation` | A string is wrong, unclear, or missing in one of the nine languages. No code required for most of these. |
| `accessibility` | Screen readers, large font sizes, contrast, touch targets. |
| `needs triage` | Nobody has looked at it yet. Feel free to comment, but a maintainer may still close it as out of scope. |
| `blocked: needs discussion` | The change is wanted but the approach isn't settled. Don't start building. |

Comment on an issue before you start so two people don't do the same work.
Nobody will mind if you say so and then change your mind.

## The four areas where help matters most

### 1. Translations

The highest-value contribution, and the one you can make without touching
TypeScript. ReadyNow ships nine languages: English, Spanish, Korean, French,
Haitian Creole, Chinese, Arabic, Dari and Pashto.

Some strings were machine-generated and have never been read by a native
speaker. They are listed in [translation-review.md](translation-review.md),
along with what specifically needs checking. Start there.

Two ways to help, both welcome:

- **Just tell us.** Open a
  [translation correction issue](https://github.com/Human-Rights-First-Innovation-Lab/readynow/issues/new/choose).
  You do not need git, and you do not need to propose replacement wording — "this
  reads like a machine wrote it" from a fluent speaker is useful on its own.
- **Send a PR.** Files live in `app/translations/`, one JSON file per screen.
  Each is keyed by language code first, then by string:

  ```json
  {
    "en": { "cancel": "Cancel" },
    "es": { "cancel": "Cancelar" },
    "kr": { "cancel": "취소" }
  }
  ```

  Language codes are `en`, `es`, `kr`, `fr`, `ht`, `zh`, `ar`, `dr`, `ps`. Edit
  only the language you speak; leave the others alone.

Two things to keep in mind. **Accuracy beats fluency** where the string is a
consent prompt or a safety instruction — softening "never" into "usually not"
turns a promise into a false one. And **length matters**: a translation that is
much longer than the English can overflow a button on a small screen. If you can,
check it at a large font size.

### 2. Accessibility

Users may have poor vision, may be using the phone one-handed under stress, or
may have the system font scaled well above default. Useful work here:

- Screen reader labels on controls that don't have them
- Layouts that break at large font sizes — a real problem we already know about
- Contrast and touch target sizes

### 3. Testing on older Android devices

The app is used on old and low-end phones. If you have one, running through
onboarding and a test alert and reporting what you find is a real contribution.
Include the device and OS version.

### 4. Documentation

If something in the README or CONTRIBUTING was wrong or missing when you set
up, fix it. You are the only person who will ever see that problem clearly —
after a week of working on the code, nobody can see it any more.

## Your first pull request, start to finish

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/<you>/readynow.git
cd readynow

# 2. Base your work on develop, not main
git checkout develop
git checkout -b <yourname>/fix/short-description

# 3. Set up
npm ci
cp app/google-services.json.template app/google-services.json
npm start

# 4. Make the change, then check it
npm run type-check     # must be clean
npm run test:coverage  # single run; note that `npm test` runs in watch mode
npm run lint

# 5. Commit with a sign-off (see DCO.md) and a Conventional Commits subject
git commit -s -m "fix(plan): keep the delete confirmation readable at 200% font size"

# 6. Push and open a PR against develop
git push -u origin HEAD
```

Branch names follow `<author>/<type>/<short-description>`. Commit subjects
follow [Conventional Commits](https://www.conventionalcommits.org): `feat`,
`fix`, `chore`, `docs`, with a scope in parentheses.

The `-s` is not optional: CI fails the PR if any commit is missing its
`Signed-off-by` line. If you forget, `git commit --amend -s --no-edit` fixes the
last one and `git rebase --signoff develop` fixes the whole branch — see
[DCO.md](../DCO.md).

## What happens next

A maintainer reads it. Expect a first response within about a week — this is a
small team at a nonprofit, and a quiet PR is not a rejected one.

You will likely get change requests. That is normal and is not a judgement on
the work; this app is used in situations where a subtle bug has real
consequences, so review here is closer than you may be used to. If a request
doesn't make sense, say so — sometimes the reviewer is wrong.

## Things that will get a PR closed

- **International phone number support.** Deliberately out of scope, and
  explained in [international-phone-numbers.md](international-phone-numbers.md).
- **Over-the-air updates.** Considered and declined.
- **Changes to `twilio/` you didn't ask about first.** Those endpoint URLs are
  compiled into app bundles already installed on people's phones, and there is
  no over-the-air update mechanism to fix them.
- **A large refactor nobody asked for.** Ask before you build; it saves you the
  disappointment.
