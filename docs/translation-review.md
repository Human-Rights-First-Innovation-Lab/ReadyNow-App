# Translations pending native-speaker review

Most of `app/translations/` was translated through the project's normal
process. The file below was not, and is flagged here so a reviewer can find it
without reading every diff.

## `crash-reporting.json` — 8 languages, 20 strings each

Added in the commit that closed the crash-reporting consent gap. English was
written by the team; **es, kr, fr, ht, zh, ar, dr and ps were machine-generated
and have not been reviewed by a native speaker.**

This matters more than a normal translation gap. These strings are a **consent
prompt**: the user is deciding whether to send crash reports. Consent given
against text the user cannot properly read is not meaningful consent, so the
wording has to be *accurate*, not merely understandable.

### What a reviewer should check

- **`neverItem1`–`neverItem4` must not overstate or understate.** They are
  promises about what we never collect. A translation that softens "never" into
  "usually not" is a false promise.
- **`yourChoice`** must make clear the app works identically either way, so
  nobody feels pressured into consenting to keep the app working.
- **`accept` / `decline`** must be unambiguous opposites at a glance. A user in
  a hurry should not be able to mistake one for the other.
- **"A-Number"** is a US immigration term (Alien Registration Number). It is
  left untranslated in most languages, with a gloss added in `kr` and `zh`.
  Confirm that is the form your community actually recognises.
- **Register and formality.** Spanish uses *usted*; confirm that matches the
  rest of the app.
- **Dari vs Iranian Persian.** Afghan usage was intended (تیلفون, مودل, پلان,
  معلومات) rather than the Iranian equivalents. Worth a check.
- **Bullet rendering in RTL** (ar, dr, ps). Each item is stored with a leading
  `"• "`. This has not been verified on a device — confirm the bullet appears
  on the correct side and does not break the line.

### How to submit a correction

Edit `app/translations/crash-reporting.json` and open a pull request. The
language keys are `en, es, kr, fr, ht, zh, ar, dr, ps`. Every language must
carry all 20 keys — `npm run type-check` enforces this via the `satisfies`
constraint in `app/translations/index.ts`, so a missing key fails CI rather
than silently falling back.
